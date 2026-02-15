declare module 'd2r/object-manager' {
  import { EventEmitter } from 'events';
  import { Unit } from 'd2r/unit';
  import { Player, LocalPlayer } from 'd2r/player';

  export class ObjectManager extends EventEmitter {
    me: LocalPlayer | null;

    /**
     * Reset the object manager state
     */
    reset(): void;

    /**
     * Get all units of a specific type
     * @param type Unit type (0=Player, 1=Monster, 2=Object, 3=Missile, 4=Item, 5=Tile)
     */
    getUnits(type: number): Map<number, Unit>;

    /**
     * Update the object manager state by scanning the game's unit tables
     * @returns true if successful, false if game lock could not be acquired
     */
    tick(): boolean;

    /**
     * Last tick time as a formatted string
     */
    readonly tickTime: string;

    /**
     * Last game lock acquisition time as a formatted string
     */
    readonly gameLockTime: string;

    // Event emitter methods
    on(event: 'unitAdded', listener: (unit: Unit, type: number) => void): this;
    on(event: 'unitRemoved', listener: (unit: Unit, type: number) => void): this;
    on(event: string, listener: (...args: any[]) => void): this;
  }
}
