module ARM.Simulator.Elf {
    /**
     * Defines the different possible architectures an ELF file can target.
     */
    export enum ElfMachine {
        /**
         * No machine.
         */
        None = 0x00,

        /**
         * AT&T WE 32100.
         */
        M32 = 0x01,

        /**
         * SPARC.
         */
        Sparc = 0x02,

        /**
         * Intel 386 Architecture.
         */
        X86 = 0x03,

        /**
         * Motorola 68000.
         */
        M68k = 0x04,

        /**
         * Motorola 88000.
         */
        M88k = 0x05,

        /**
         * Intel 80860.
         */
        I860 = 0x07,

        /**
         * MIPS RS3000 Big-Endian.
         */
        Mips = 0x08,

        /**
         * MIPS RS4000 Big-Endian.
         */
        MipsRs4Be = 0x0A,

        /**
         * ARM 32-bit architecture (AARCH32).
         */
        Arm = 0x28
    }
}