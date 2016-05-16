module ARM.Simulator.Elf {
    /**
     * Defines the different possible flags that can be set for segments of an ELF file.
     *
     * @remarks
     *  A text segment commonly has the flags 'Execute' and 'Read'. A data segment commonly has
     *  'Execute', 'Write' and 'Read'.
     */
    export enum ElfSegmentFlag {
        /**
         * An executable segment.
         */
        Execute = 0x01,

        /**
         * A writable segment.
         */
        Write = 0x02,

        /**
         * A readable segment.
         */
        Read = 0x04
    }
}