module ARM.Simulator {
    /**
     * The operating states supported by the ARM7 processors.
     */
    export enum CpuState {
        /**
         * 32-bit, word-aligned ARM instructions are executed in this state.
         */
        ARM,

        /**
         * 16-bit, halfword-aligned Thumb instructions are executed in this state.
         */
        Thumb
    }
}