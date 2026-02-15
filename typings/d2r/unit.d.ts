declare module 'd2r/unit' {
  export class Unit {
    // UnitModel fields
    type: number;
    classId: number;
    id: number;
    mode: number;
    data: bigint;
    actId: bigint;
    drlgAct: any;
    seed: any;
    initSeed: any;
    path: any;
    animSeqFrame: number;
    animSeqFrame2: number;
    animSeqFrameCount: number;
    animSpeed: number;
    animData: bigint;
    gfxData: bigint;
    statListEx: bigint;
    inventory: bigint;
    packetList: bigint;
    posX: number;
    posY: number;
    skills: any;
    flags: number;
    flagsEx: number;
    changeNextUnit: bigint;
    unitNext: bigint;
    roomUnitNext: bigint;
    collisionUnitType: number;
    collisionUnitClassId: number;
    collisionUnitSizeX: number;
    collisionUnitSizeY: number;
    _address: bigint;

    // Unit methods
    readonly isValid: boolean;
  }
}
