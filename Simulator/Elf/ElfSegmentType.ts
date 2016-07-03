module ARM.Simulator.Elf {
    /**
     * Defines the different possible types of segments of an ELF file.
     */
    export enum ElfSegmentType {
        /**
         * The array element is unused; other members' values are undefined.
         */
        Null = 0x00,

        /**
         * The array element specifies a loadable segment.
         */
        Load = 0x01,

        /**
         * The array element specifies dynamic linking information.
         */
        Dynamic = 0x02,

        /**
         * The array element specifies the location and size of a null-terminated path name to
         * invoke as an interpreter.
         */
        Interpreter = 0x03,

        /**
         * The array element specifies the location and size of auxiliary information.
         */
        Note = 0x04,

        /**
         * This segment type is reserved but has unspecified semantics.
         */
        Shlib = 0x05,

        /**
         * The array element, if present, specifies the location and size of the program header
         * table itself.
         */
        PHdr = 0x06
    }
}