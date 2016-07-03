module ARM.Simulator.Elf {
    /**
     * Defines the different possible types of ELF object files.
     */
    export enum ElfType {
        /**
         * No file type.
         */
        None = 0x00,

        /**
         * Relocatable file.
         */
        Relocatable = 0x01,

        /**
         * Executable file.
         */
        Executable = 0x02,

        /**
         * Shared object file.
         */
        Dynamic = 0x03,

        /**
         * Core file.
         */
        Core = 0x04,

        /**
         * Processor-specific.
         */
        LoProc = 0xFF00,

        /**
         * Processor-specific.
         */
        HiProc = 0xFFFF
    }
}