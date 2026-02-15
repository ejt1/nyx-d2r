declare module 'd2r/item' {
  import { Unit } from 'd2r/unit';

  export class Item extends Unit {
    readonly isOnGround: boolean;
    readonly isEquipped: boolean;
    readonly isInBelt: boolean;
  }
}
