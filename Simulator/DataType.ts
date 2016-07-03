module ARM.Simulator {
    /**
     * The data types supported by the ARM7 processors.
     */
    export enum DataType {
        /**
         * 8-bit quantity that can be placed on any byte boundary.
         */
        Byte,

        /**
         * 16-bit quantity that must be aligned to two-byte boundaries.
         */
        Halfword,

        /**
         * 32-bit quantity that must be aligned to four-byte boundaries.
         */
        Word
    }
}