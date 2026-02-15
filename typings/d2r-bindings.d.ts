// Ambient declarations for d2r internalBinding() function
// Provides type-safe access to d2r C++ bindings

/**
 * Access d2r internal C++ bindings
 */
declare function internalBinding(module: 'd2r'): {
  /**
   * Log a message
   */
  log(message: string): void;

  /**
   * Reveal a level on the map
   * @param levelId The level ID to reveal
   * @returns true if successful
   */
  revealLevel(levelId: number): boolean;

  /**
   * Get player ID by index
   */
  getPlayerIdByIndex(index: number): number;

  /**
   * Get the local player's index
   */
  getLocalPlayerIndex(): number;

  /**
   * Get the address of the client-side unit hash table
   */
  getClientSideUnitHashTableAddress(): bigint;

  /**
   * Get the address of the server-side unit hash table
   */
  getServerSideUnitHashTableAddress(): bigint;
};
