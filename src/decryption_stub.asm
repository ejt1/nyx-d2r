PUBLIC DecryptAddress
PUBLIC DecryptGadget

.code
DecryptAddress PROC
  mov   rax, rcx
  jmp   qword ptr [DecryptGadget]
DecryptAddress ENDP

.data
  ALIGN 8
DecryptGadget dq 0
END
