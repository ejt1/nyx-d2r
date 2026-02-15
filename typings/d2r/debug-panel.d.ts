declare module 'd2r/debug-panel' {
  import { ObjectManager } from 'd2r/object-manager';
  import { Widget } from 'gui';

  export class DebugPanel {
    constructor(objectManager: ObjectManager);

    /**
     * Refresh the debug panel display with current unit data
     */
    refresh(): void;

    /**
     * Get the panel widget
     */
    readonly panel: Widget;

    /**
     * Destroy the debug panel and clean up resources
     */
    destroy(): void;
  }
}
