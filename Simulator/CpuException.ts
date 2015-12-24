﻿module ARM.Simulator {
    /**
     * The exceptions that can arise in ARM7 processors whenever the normal flow of execution has
     * to be halted temporarily.
     */
    export enum CpuException {
        /**
         * Reset exception. Occurs when the processor reset pin is asserted.
         */
        Reset = 0x00,

        /**
         * The exception that arises when the ARM7 processor encounters an instruction that
         * neither it, nor any coprocessor in the system can handle.
         */
        Undefined = 0x04,

        /**
         * The Software Interrupt instruction (SWI) is used to enter Supervisor mode, usually
         * to request a particular supervisor function.
         */
        Software = 0x08,

        /**
         * The exception that arises when a memory transaction on an opcode fetch failed to
         * complete successfully.
         */
        Prefetch = 0x0C,

        /**
         * The exception that arises when a memory transaction on a data access failed to
         * complete successfully.
         */
        Data = 0x10,

        /**
         * The exception that arises when an interrupt is asserted by taking the nIRQ input
         * low.
         */
        IRQ = 0x18,

        /**
         * The Fast Interrupt Request (FIQ) exception supports data transfers or channel
         * processes. An FIQ is externally generated by taking the nFIQ input low.
         */
        FIQ = 0x1C
    }
}