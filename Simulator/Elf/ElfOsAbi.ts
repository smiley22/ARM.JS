module ARM.Simulator.Elf {
    /**
     * Defines the different possible values for the target operating-system ABI of an ELF file.
     */
    export enum ElfOsAbi {
        /**
         * No extensions or unspecified
         */
        None = 0x00,

        /**
         * Hewlett-Packard HP-UX
         */
        HpUx = 0x01,

        /**
         * NetBSD
         */
        NetBSD = 0x02,

        /**
         * GNU
         */
        Gnu = 0x03,

        /**
         * Sun Solaris
         */
        Solaris = 0x06,

        /**
         * AIX
         */
        Aix = 0x07,

        /**
         * IRIX
         */
        Irix = 0x08,

        /**
         * FreeBSD
         */
        FreeBSD = 0x09,

        /**
         * Compaq TRU64 UNIX
         */
        Tru64 = 0x0A,

        /**
         * Novell Modesto
         */
        Modesto = 0x0B,

        /**
         * Open BSD
         */
        OpenBSD = 0x0C,

        /**
         * Open VMS
         */
        OpenVMS = 0x0D,

        /**
         * Hewlett-Packard Non-Stop Kernel
         */
        HpNSK = 0x0E,

        /**
         * Amiga Research OS
         */
        Aros = 0x0F,

        /**
         * The FenixOS highly scalable multi-core OS
         */
        FenixOS = 0x10,

        /**
         * Nuxi CloudABI
         */
        CloudABI = 0x11,

        /**
         * Stratus Technologies OpenVOS
         */
        OpenVOS = 0x12
    }
}