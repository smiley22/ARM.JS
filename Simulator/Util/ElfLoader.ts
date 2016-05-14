module ARM.Simulator {
    /**
     * A utility class for reading and loading 'Executable and Linkable Format' (ELF) images.
     */
    export class ElfLoader {
    }


    /**
     * Represents the ELF header that resides at the beginning of any ELF file.
     */
    class ElfHeader {
        /**
         * Identifies the file's class, or capacity.
         */
        private class: ElfClass;

        /**
         * Specifies the data encoding of the processor-specific data in the object file.
         */
        private data: ElfData;

        /**
         * Specifies the ELF header version number.
         */
        private version: ElfVersion;

        /**
         * Identifies the object file type.
         */
        private type: ElfType;

        /**
         * Specifies the required architecture for the individual file.
         */
        private machine: ElfMachine;

        /**
         * The virtual address of the entry point of the object file.
         */
        private entry: number;

        /**
         * Holds the program header table's file offset in bytes. If the file has no program
         * header table, this member holds zero.
         */
        private phTableOffset: number;

        /**
         * Holds the section header table's file offset in bytes. If the file has no section
         * header table, this member holds zero.
         */
        private shTableOffset: number;

        /**
         * Holds processor-specific flags associated with the file.
         */
        private flags: ElfFlags;

        /**
         * Holds the ELF header's size in bytes.
         */
        private size: number;

        /**
         * Holds the size in bytes of one entry in the file's program header table.
         */
        private phEntrySize: number;

        /**
         * Holds the number of entries in the program header table.
         */
        private phTableNumEntries: number;

        /**
         * Holds a section header's size in bytes.
         */
        private shEntrySize: number;

        /**
         * Holds the number of entries in the section header table.
         */
        private shTableNumEntries: number;

        /**
         * holds the section header table index of the entry associated with the section name
         * string table.
         */
        private shTableStrIndex: number;

        /**
         * Gets the ELF file's class, or capacity.
         *
         * @return {ElfClass}
         *  The ELF file's class, or capacity.
         */
        public get Class(): ElfClass {
            return this.class;
        }

        /**
         * Gets the data encoding of the processor-specific data in the object file.
         *
         * @return {ElfData}
         *  The data encoding of the processor-specific data in the ELF file.
         */
        public get Data(): ElfData {
            return this.data;
        }

        /**
         * Gets the ELF header version.
         *
         * @return {ElfVersion}
         *  The ELF header version.
         */
        public get Version(): ElfVersion {
            return this.version;
        }

        /**
         * Gets the object file type.
         *
         * @return {ElfType}
         *  The object file type.
         */
        public get Type(): ElfType {
            return this.type;
        }

        /**
         * Gets the architecture for the ELF file.
         *
         * @return {ElfMachine}
         *  The architecture for the ELF file.
         */
        private get Machine(): ElfMachine {
            return this.machine;
        }

        /**
         * Gets the virtual address of the entry point of the object file.
         *
         * @return {number}
         *  The virtual address of the entry point of the object file.
         */
        public get Entry(): number {
            return this.entry;
        }

        /**
         * Gets the processor-specific flags associated with the file.
         *
         * @return {ElfFlags}
         *  The processor-specific flags associated with the file.
         */
        public get Flags(): ElfFlags {
            return this.flags;
        }

        /**
         * Gets the program header table's file offset in bytes.
         *
         * @return {number}
         *  The program header table's file offset in bytes, or zero if the file has no program
         *  header table.
         */
        public get ProgramHeaderTableOffset(): number {
            return this.phTableOffset;
        }

        /**
         * Gets the size in bytes of one entry in the file's program header table.
         *
         * @return {number}
         *  The size in bytes of one entry in the file's program header table.
         */
        public get ProgramHeaderSize(): number {
            return this.phEntrySize;
        }

        /**
         * Gets the number of entries in the program header table.
         *
         * @return {number}
         *  The number of entries in the program header table.
         */
        public get NumberOfProgramHeaders(): number {
            return this.phTableNumEntries;
        }

        /**
         * Gets the section header table's file offset in bytes.
         *
         * @return {number}
         *  The section header table's file offset in bytes, or zero if the file has no section
         *  header table.
         */
        public get SectionHeaderTableOffset(): number {
            return this.shTableOffset;
        }

        /**
         * Gets the size in bytes of one entry in the file's section header table.
         *
         * @return {number}
         *  The size in bytes of one entry in the file's section header table.
         */
        public get SectionHeaderSize(): number {
            return this.shEntrySize;
        }

        /**
         * Gets the number of entries in the section header table.
         *
         * @return {number}
         *  The number of entries in the section header table.
         */
        public get NumberOfSectionHeaders(): number {
            return this.shTableNumEntries;
        }

        /**
         * Gets the section header table index of the entry associated with the section name
         * string table.
         *
         * @return {number}
         *  The the section header table index of the entry associated with the section name
         *  string table, or zero if the file has no section name string table.
         */
        public get SectionHeaderStrIndex(): number {
            return this.shTableStrIndex;
        }

        /**
         * The "magic number" identifying a file as an ELF.
         */
        private static Magic = [0x7F, 0x45, 0x4C, 0x46];

        /**
         * The size of the ELF header structure, in bytes.
         */
        public static Size = 0x30;

        /**
         * Deserializes an instance of the ElfHeader class from the specified sequence of
         * bytes.
         *
         * @param data
         *  The byte array from which to deserialize the ELF header.
         * @return {ElfHeader}
         *  An instance of the ElfHeader class deserialized from the specified sequence of
         *  bytes.
         * @throw {Error}
         *  The specified sequence of bytes is not a valid ELF header.
         */
        public static Deserialize(data: number[]): ElfHeader {
            var eh = new ElfHeader();
            var br = new ARM.Simulator.BinaryReader(data);
            br.ReadBytes(4).forEach((v, i) => {
                if (v != ElfHeader.Magic[i])
                    throw new Error('Magic number mismatch');
            });
            if ((eh.class = br.ReadUint8()) == 0)
                throw new Error('Invalid class');
            if ((eh.data = br.ReadUint8()) == 0)
                throw new Error('Invalid data encoding');
            if ((eh.version = br.ReadUint8()) == 0)
                throw new Error('Invalid version');
            // Skip 8 padding bytes currently unused.
            br.ReadBytes(8);
            if ((eh.type = br.ReadUint16()) == 0)
                throw new Error('No file type');
            eh.machine = br.ReadUint16();
            // Skip Version as its the same as ei_version of e_ident.
            if (eh.version != br.ReadUint32())
                throw new Error('Version mismatch');
            eh.entry = br.ReadUint32();
            eh.phTableOffset = br.ReadUint32();
            eh.shTableOffset = br.ReadUint32();
            // Machine-specific flags.
            eh.flags = br.ReadUint32();
            eh.size = br.ReadUint16();
            eh.phEntrySize = br.ReadUint16();
            eh.phTableNumEntries = br.ReadUint16();
            eh.shEntrySize = br.ReadUint16();
            eh.shTableNumEntries = br.ReadUint16();
            eh.shTableStrIndex = br.ReadUint16();
            return eh;
        }
    }

    /**
     * Represents a program header entry of an ELF file.
     */
    class ProgramHeader {
        /**
         * Specifies what kind of segment this program header element describes.
         */
        private type: SegmentType;

        /**
         * Gives the offset from the beginning of the file at which the first byte of the
         * segment resides.
         */
        private offset: number;

        /**
         * Gives the virtual address at which the first byte of the segment resides in memory.
         */
        private virtualAddress: number;

        /**
         * On systems for which physical addressing is relevant, this member is reserved for the
         * segment's physical address.
         */
        private physicalAddress: number;

        /**
         * Gives the number of bytes in the file image of the segment; it may be zero.
         */
        private fileSize: number;

        /**
         * Gives the number of bytes in the memory image of the segment; it may be zero.
         */
        private memorySize: number;

        /**
         * Gives flags relevant to the segment.
         */
        private flags: number;

        /**
         * Gives the value to which the segments are aligned in memory and in the file.
         */
        private align: number;

        /**
         * Gets what kind of segment this program header element describes.
         *
         * @return {SegmentType}
         *  The type of segment this program header element describes.
         */
        public get Type(): SegmentType {
            return this.type;
        }

        /**
         * Gets the offset from the beginning of the file at which the first byte of the
         * segment resides.
         *
         * @return {number}
         *  The offset from the beginning of the file at which the first byte of the segment
         *  resides.
         */
        public get Offset(): number {
            return this.offset;
        }

        /**
         * Gets the virtual address at which the first byte of the segment resides in memory.
         *
         * @return {number}
         *  The virtual address at which the first byte of the segment resides in memory.
         */
        public get VirtualAddress(): number {
            return this.virtualAddress;
        }

        /**
         * Gets the physical address at which the first byte of the segment resides in memory.
         *
         * @return {number}
         *  The physical address at which the first byte of the segment resides in memory.
         */
        public get PhysicalAddress(): number {
            return this.physicalAddress;
        }

        /**
         * Gets the number of bytes in the file image of the segment.
         *
         * @return {number}
         *  The number of bytes in the file image of the segment; it may be zero.
         */
        public get FileSize(): number {
            return this.fileSize;
        }

        /**
         * Gets the number of bytes in the memory image of the segment.
         *
         * @return {number}
         *  The number of bytes in the memory image of the segment; it may be zero.
         */
        public get MemorySize(): number {
            return this.memorySize;
        }

        /**
         * Gets the flags relevant to the segment.
         *
         * @return {number}
         *  The flags relevant to the segment.
         */
        public get Flags(): number {
            return this.flags;
        }

        /**
         * Gets the value to which the segments are aligned in memory and in the file.
         *
         * @return {number}
         *  The value to which the segments are aligned in memory and in the file.
         * @remarks
         *  Values 0 and 1 mean that no alignment is required. Otherwise, 'Align' should be a
         *  positive, integral power of 2, and 'PhysicalAddress' should equal 'Offset' modulo
         *  'Align'.
         */
        public get Align(): number {
            return this.align;
        }

        /**
         * The size of the program header structure, in bytes.
         */
        public static Size = 32;

        /**
         * Deserializes an instance of the ProgramHeader class from the specified sequence of
         * bytes.
         *
         * @param data
         *  The byte array from which to deserialize the program header.
         * @return {ElfHeader}
         *  An instance of the ProgramHeader class deserialized from the specified sequence of
         *  bytes.
         * @throw {Error}
         *  The specified sequence of bytes is not a valid program header.
         */
        public static Deserialize(data: number[]): ProgramHeader {
            var br = new BinaryReader(data);
            var ph = new ProgramHeader();
            ph.type = br.ReadUint32();
            ph.offset = br.ReadUint32();
            ph.virtualAddress = br.ReadUint32();
            ph.physicalAddress = br.ReadUint32();
            ph.fileSize = br.ReadUint32();
            ph.memorySize = br.ReadUint32();
            ph.flags = br.ReadUint32();
            ph.align = br.ReadUint32();
            return ph;
        }
    }

    /**
     * Defines the different possible types of segments of an ELF file.
     */
    enum SegmentType {
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

    /**
     * Defines the different possible values for the Class of an ELF file.
     */
    enum ElfClass {
        /**
         * The file-format supports machines with files and virtual address spaces up to 4
         * gigabytes.
         */
        _32 = 0x01,

        /**
         * The file-format supports machines with files and virtual address spaces of 64-bit
         * architectures.
         */
        _64   = 0x02
    }

    /**
     * Defines the different possible values for the data-encoding of the processor-specific
     * data in an ELF file.
     */
    enum ElfData {
        /**
         * The data-encoding specifies 2's complement values, with the least significant byte
         * occupying the lowest address.
         */
        LittleEndian = 0x01,

        /**
         * The data-encoding specifies 2's complement values, with the most significant byte
         * occupying the lowest address.
         */
        BigEndian = 0x02
    }

    /**
     * Defines the different possible values for the version field of the ELF header.
     */
    enum ElfVersion {
        /**
         * Signifies the original file format.
         */
        Current = 0x01
    }

    /**
     * Defines the different possible types of ELF object files.
     */
    enum ElfType {
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

    /**
     * Defines the different possible architectures an ELF file can target.
     */
    enum ElfMachine {
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
         * ARM Architecture.
         */
        Arm = 0x28
    }

    enum ElfFlags {
    }
}