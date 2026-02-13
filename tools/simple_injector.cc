#include <Windows.h>
//
#include <TlHelp32.h>

#include <atomic>
#include <cstdio>
#include <filesystem>
#include <string>
#include <thread>

constexpr auto kTargetName = "D2R.exe";
constexpr auto kModuleName = "nyx.d2r.dll";
constexpr auto kPipeName = "\\\\.\\pipe\\dolos_log";

static std::atomic<bool> g_running{true};

static DWORD FindProcessByName(const char* name) {
  HANDLE snapshot = nullptr;
  PROCESSENTRY32 pe32{sizeof(PROCESSENTRY32)};
  DWORD pid = 0;

  snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
  if (!snapshot) {
    fprintf(stderr, "could not create process snapshot\n");
    goto cleanup;
  }

  if (!Process32First(snapshot, &pe32)) {
    fprintf(stderr, "could not get process entry from snapshot\n");
    goto cleanup;
  }

  do {
    if (stricmp(name, pe32.szExeFile) == 0) {
      pid = pe32.th32ProcessID;
      break;
    }
  } while (Process32Next(snapshot, &pe32));

cleanup:
  if (snapshot) {
    CloseHandle(snapshot);
  }
  return pid;
}

static void WaitForModuleUnload(DWORD pid, const char* module_name) {
  HANDLE snapshot = nullptr;
  MODULEENTRY32 me32{sizeof(MODULEENTRY32)};
  bool found = false;

  do {
    found = false;
    snapshot = CreateToolhelp32Snapshot(TH32CS_SNAPMODULE, pid);
    if (!snapshot) {
      fprintf(stderr, "could not create module snapshot\n");
      return;
    }

    if (!Module32First(snapshot, &me32)) {
      fprintf(stderr, "could not get module entry from snapshot\n");
      CloseHandle(snapshot);
      return;
    }

    do {
      if (stricmp(module_name, me32.szModule) == 0) {
        found = true;
      }
    } while (Module32Next(snapshot, &me32));

    CloseHandle(snapshot);
    snapshot = nullptr;
    Sleep(1000);
  } while (found && g_running);
}

// Pipe server that receives logs from the injected DLL
class PipeServer {
 public:
  PipeServer() : pipe_(INVALID_HANDLE_VALUE), connected_(false) {}

  ~PipeServer() { Stop(); }

  bool Start() {
    pipe_ = CreateNamedPipeA(kPipeName,
                             PIPE_ACCESS_DUPLEX | FILE_FLAG_OVERLAPPED,
                             PIPE_TYPE_MESSAGE | PIPE_READMODE_MESSAGE | PIPE_WAIT,
                             1,       // max instances
                             4096,    // out buffer
                             4096,    // in buffer
                             0,       // timeout
                             nullptr  // security
    );

    if (pipe_ == INVALID_HANDLE_VALUE) {
      fprintf(stderr, "Failed to create pipe: %d\n", GetLastError());
      return false;
    }

    running_ = true;
    server_thread_ = std::thread(&PipeServer::ServerLoop, this);
    return true;
  }

  void Stop() {
    running_ = false;
    if (pipe_ != INVALID_HANDLE_VALUE) {
      // Cancel any pending I/O
      CancelIoEx(pipe_, nullptr);
      DisconnectNamedPipe(pipe_);
      CloseHandle(pipe_);
      pipe_ = INVALID_HANDLE_VALUE;
    }
    if (server_thread_.joinable()) {
      server_thread_.join();
    }
  }

  bool SendCommand(const std::string& cmd) {
    if (!connected_ || pipe_ == INVALID_HANDLE_VALUE) {
      return false;
    }

    std::string msg = cmd + "\n";
    DWORD written = 0;
    return WriteFile(pipe_, msg.c_str(), static_cast<DWORD>(msg.size()), &written, nullptr) != 0;
  }

 private:
  void ServerLoop() {
    char buffer[4096];

    while (running_) {
      // Wait for client connection
      fprintf(stdout, "[Pipe] Waiting for client...\n");

      OVERLAPPED overlapped = {};
      overlapped.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);

      BOOL connected = ConnectNamedPipe(pipe_, &overlapped);
      if (!connected) {
        DWORD err = GetLastError();
        if (err == ERROR_IO_PENDING) {
          // Wait for connection with timeout so we can check running_
          while (running_) {
            DWORD result = WaitForSingleObject(overlapped.hEvent, 500);
            if (result == WAIT_OBJECT_0) {
              connected = TRUE;
              break;
            }
          }
        } else if (err == ERROR_PIPE_CONNECTED) {
          connected = TRUE;
        }
      }

      CloseHandle(overlapped.hEvent);

      if (!running_) break;

      if (connected) {
        connected_ = true;
        fprintf(stdout, "[Pipe] Client connected\n");

        // Read messages from client
        while (running_) {
          DWORD bytes_read = 0;
          OVERLAPPED read_overlapped = {};
          read_overlapped.hEvent = CreateEvent(nullptr, TRUE, FALSE, nullptr);

          BOOL success = ReadFile(pipe_, buffer, sizeof(buffer) - 1, &bytes_read, &read_overlapped);

          if (!success) {
            DWORD err = GetLastError();
            if (err == ERROR_IO_PENDING) {
              // Wait for read with timeout
              while (running_) {
                DWORD result = WaitForSingleObject(read_overlapped.hEvent, 500);
                if (result == WAIT_OBJECT_0) {
                  GetOverlappedResult(pipe_, &read_overlapped, &bytes_read, FALSE);
                  success = TRUE;
                  break;
                }
              }
            } else if (err == ERROR_BROKEN_PIPE || err == ERROR_PIPE_NOT_CONNECTED) {
              CloseHandle(read_overlapped.hEvent);
              break;  // Client disconnected
            }
          }

          CloseHandle(read_overlapped.hEvent);

          if (!running_) break;

          if (success && bytes_read > 0) {
            buffer[bytes_read] = '\0';
            // Print received log message
            fprintf(stdout, "%s", buffer);
            fflush(stdout);
          }
        }

        connected_ = false;
        fprintf(stdout, "[Pipe] Client disconnected\n");
        DisconnectNamedPipe(pipe_);
      }
    }
  }

  HANDLE pipe_;
  std::atomic<bool> running_{false};
  std::atomic<bool> connected_{false};
  std::thread server_thread_;
};

static PipeServer g_pipe_server;

// Console control handler for clean shutdown
BOOL WINAPI ConsoleHandler(DWORD signal) {
  if (signal == CTRL_C_EVENT || signal == CTRL_BREAK_EVENT || signal == CTRL_CLOSE_EVENT) {
    fprintf(stdout, "\nShutting down...\n");
    g_running = false;
    g_pipe_server.Stop();
    return TRUE;
  }
  return FALSE;
}

int main() {
  DWORD pid = 0;
  HANDLE process = nullptr;
  LPVOID path_address = nullptr;
  HMODULE kernel32 = nullptr;
  FARPROC load_library = nullptr;
  HANDLE load_thread = nullptr;
  DWORD arg = 0;
  std::filesystem::path filename;
  std::string filename_str;

  SetConsoleCtrlHandler(ConsoleHandler, TRUE);

  if (!g_pipe_server.Start()) {
    fprintf(stderr, "Failed to start pipe server\n");
    return EXIT_FAILURE;
  }
  fprintf(stdout, "Pipe server started on %s\n", kPipeName);

  pid = FindProcessByName(kTargetName);
  if (pid == 0) {
    fprintf(stderr, "could not find %s\n", kTargetName);
    goto cleanup;
  }

  process = OpenProcess(PROCESS_ALL_ACCESS, FALSE, pid);
  if (!process || process == INVALID_HANDLE_VALUE) {
    fprintf(stderr, "could not attach to %s\n", kTargetName);
    goto cleanup;
  }

  filename = std::filesystem::current_path() / kModuleName;
  filename_str = filename.string();

  path_address = VirtualAllocEx(process, nullptr, 0x200, MEM_COMMIT | MEM_RESERVE, PAGE_READWRITE);
  if (path_address == 0) {
    fprintf(stderr, "failed to allocate memory for path\n");
    goto cleanup;
  }

  if (!WriteProcessMemory(process, path_address, filename_str.c_str(), filename_str.length() + 1, nullptr)) {
    fprintf(stderr, "failed to write memory\n");
    goto cleanup;
  }

  kernel32 = GetModuleHandle("kernel32.dll");
  if (!kernel32) {
    fprintf(stderr, "injection: could not get kernel32.dll (%d)\n", GetLastError());
    goto cleanup;
  }
  load_library = GetProcAddress(kernel32, "LoadLibraryA");
  if (!load_library) {
    fprintf(stderr, "injection: could not get LoadLibraryA (%d)\n", GetLastError());
    goto cleanup;
  }

  load_thread = CreateRemoteThread(process, nullptr, 0, (LPTHREAD_START_ROUTINE)load_library, path_address, 0, 0);
  if (!load_thread) {
    fprintf(stderr, "injection: failed to create remote thread (%d)\n", GetLastError());
    goto cleanup;
  }

  WaitForSingleObject(load_thread, INFINITE);
  fprintf(stdout, "Injected, waiting for unload...\n");
  WaitForModuleUnload(pid, kModuleName);

cleanup:
  g_pipe_server.Stop();
  if (load_thread) {
    CloseHandle(load_thread);
    load_thread = nullptr;
  }
  if (path_address) {
    VirtualFreeEx(process, path_address, 0, MEM_FREE);
  }
  return EXIT_SUCCESS;
}
