module ARM.Simulator {
    /**
     * The operating modes supported by the ARM7 processors.
     */
    export enum CpuMode {
        /**
         * User mode is the usual ARM program execution state, and is used for executing most
         * application programs.
         */
        User = 0x10,

        /**
         * Fast Interrupt (FIQ) mode supports a data transfer or channel process.
         */
        FIQ = 0x11,

        /**
         * Interrupt (IRQ) mode is used for general-purpose interrupt handling.
         */
        IRQ = 0x12,

        /**
         * Supervisor mode is a protected mode for the operating system.
         */
        Supervisor = 0x13,

        /**
         * Abort mode is entered after a data or instruction Prefetch Abort.
         */
        Abort = 0x17,

        /**
         * System mode is a privileged user mode for the operating system.
         */
        System = 0x1F,

        /**
         * Undefined mode is entered when an undefined instruction is executed.
         */
        Undefined = 0x1B
    }
}