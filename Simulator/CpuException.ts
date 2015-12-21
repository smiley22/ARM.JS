module ARM.Simulator {
    /**
     * The exceptions that can arise in ARM7 processors whenever the normal flow of execution has
     * to be halted temporarily.
     */
    export enum CpuException {
        Reset = 0x00,
        Undefined = 0x04,
        Software = 0x08,
        Prefetch = 0x0C,
        Data = 0x10,
        IRQ = 0x18,
        FIQ = 0x1C
    }
}