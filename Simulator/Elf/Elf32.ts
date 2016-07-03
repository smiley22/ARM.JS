///<reference path="ElfMachine.ts"/>
///<reference path="ElfOsAbi.ts"/>
///<reference path="ElfSegment.ts"/>
///<reference path="ElfType.ts"/>
///<reference path="../Util/BinaryReader.ts"/>

module ARM.Simulator.Elf {
    /**
     * A class for loading 32-bit 'Executable and Linkable Format' (ELF) files.
     */
    export class Elf32 {
        /**
         * The "magic number" identifying a file as an ELF.
         */
        private static magic = [0x7F, 0x45, 0x4C, 0x46];

        /**
         * The size of the header of a 32-bit ELF file.
         */
        private static headerSize = 0x34;

        /**
         * The size of a program-header entry of a 32-bit ELF file.
         */
        private static phEntrySize = 0x20;

        /**
         * Determines whether multi-byte fields are encoded as big-endian.
         */
        private bigEndian: boolean;

        /**
         * The version of the ELF file.
         */
        private version: number;

        /**
         * The virtual address of the entry point of the object file.
         */
        private entryPoint: number;

        /**
         * Holds processor-specific flags associated with the file.
         */
        private flags: number;

        /**
         * Identifies the object file type.
         */
        private type: ElfType;

        /**
         * Identifies the target operating system ABI.
         */
        private osAbi: ElfOsAbi;

        /**
         * Further specifies the ABI version.
         */
        private abiVersion: number;

        /**
         * Specifies the required architecture for the individual file.
         */
        private machine: ElfMachine;

        /**
         * Holds the program header table's file offset in bytes. If the file has no program
         * header table, this member holds zero.
         */
        private phOffset: number;

        /**
         * Holds the number of entries in the program header table.
         */
        private phNumEntries: number;

        /**
         * The segments contained in the ELF file.
         */
        private segments = new Array<ElfSegment>();

        /**
         * Gets whether multi-byte fields are encoded as big-endian.
         *
         * @return {boolean}
         *  true if multi-byte fields are encoded in big-endian format; otherwise false.
         */
        get BigEndian() {
            return this.bigEndian;
        }

        /**
         * Gets the ELF header version.
         *
         * @return {number}
         *  The ELF header version.
         */
        get Version() {
            return this.version;
        }

        /**
         * Gets the virtual address of the entry point of the object file.
         *
         * @return {number}
         *  The virtual address of the entry point of the object file.
         */
        get EntryPoint() {
            return this.entryPoint;
        }

        /**
         * Gets the processor-specific flags associated with the ELF file.
         *
         * @return {number}
         *  The processor-specific flags associated with the ELF file.
         */
        get Flags() {
            return this.flags;
        }

        /**
         * Gets the object file type.
         *
         * @return {ElfType}
         *  The object file type.
         */
        get Type() {
            return this.type;
        }

        /**
         * Gets the target operating-system ABI the ELF file is targeting.
         *
         * @return {ElfOsAbi}
         *  The target operating-system ABI the ELF file is targeting.
         */
        get OsAbi() {
            return this.osAbi;
        }

        /**
         * Gets the OS Abi version.
         *
         * @return {number}
         *  The OS Abi version.
         */
        get AbiVersion() {
            return this.abiVersion;
        }

        /**
         * Gets the target instruction set architecture for which the ELF was compiled.
         *
         * @return {ElfMachine}
         *  The target instructon set architecture for which the ELF was compiled.
         */
        get Machine() {
            return this.machine;
        }

        /**
         * Gets the segments contained in the ELF file.
         *
         * @return {ElfSegment[]}
         *  An array of segments contained in the ELF file.
         */
        get Segments() {
            return this.segments;
        }

        /**
         * Initializes a new instance of the Elf32 class from the specified sequence of bytes.
         *
         * @param data
         *  The byte array from which to create a new instance of the Elf32 class.
         * @throw {Error}
         *  The specified sequence of bytes is not a valid 32-bit ELF file.
         */
        constructor(data: number[]) {
            var bReader = new BinaryReader(data);

            this.ReadElfHeader(bReader);
            this.ReadSegments (bReader);
        }

        /**
         * Reads ELF header fields from the specified BinaryReader instance.
         *
         * @param br
         *  The BinaryReader instance to read from.
         * @throw {Error}
         *  The underlying sequence of bytes does not constitute a valid header for a 32-bit
         *  ELF file.
         */
        private ReadElfHeader(br: BinaryReader) {
            br.ReadBytes(4).forEach((v, i) => {
                if (v != Elf32.magic[i])
                    throw new Error('Magic number mismatch');
            });
            if (br.ReadUint8() != 1)
                throw new Error('ELF file is not in 32-bit file-format');
            var dataEncoding = br.ReadUint8();
            switch (dataEncoding) {
                case 1:
                    this.bigEndian = false;
                    break;
                case 2:
                    this.bigEndian = true;
                    break;
                default:
                    throw new Error(`Invalid ELF data-encoding (${dataEncoding})`);
            }
            if ((this.version = br.ReadUint8()) == 0)
                throw new Error(`Invalid ELF version (${this.version})`);
            this.osAbi = br.ReadUint8();
            this.abiVersion = br.ReadUint8();
            // Skip padding bytes currently unused.
            br.ReadBytes(7);
            if ((this.type = br.ReadUint16()) == 0)
                throw new Error('No ELF file type specified');
            this.machine = br.ReadUint16();
            var elfVersion = br.ReadUint32();
            if (this.version != elfVersion)
                throw new Error(`Version mismatch (${this.version} <=> ${elfVersion})`);
            this.entryPoint = br.ReadUint32();
            this.phOffset = br.ReadUint32();
            // Skip section stuff as we're only interested in segments.
            br.ReadUint32();
            this.flags = br.ReadUint32();
            var headerSize = br.ReadUint16();
            if (Elf32.headerSize != headerSize)
                throw new Error(`Unexpected ELF header size (${headerSize})`);
            var phEntrySize = br.ReadUint16();
            if (Elf32.phEntrySize != phEntrySize)
                throw new Error(`Unexpected ELF program-header size (${phEntrySize})`);
            this.phNumEntries = br.ReadUint16();
            // Ignore rest of section-related header fields.
        }

        /**
         * Reads the segments of the ELF file.
         *
         * @param br
         *  The BinaryReader instance to read from.
         * @throw {Error}
         *  The end of file was reached, unexpectedly.
         */
        private ReadSegments(br: BinaryReader) {
            // Seek to the start of the program-header table.
            br.Seek(this.phOffset);
            for (var i = 0; i < this.phNumEntries; i++)
                this.segments.push(this.ReadSegment(br));
        }

        /**
         * Reads an ELF segment from the specified BinaryReader instance.
         *
         * @param br
         *  The BinaryReader instance to read from.
         * @throw {Error}
         *  The end of file was reached, unexpectedly.
         */
        private ReadSegment(br: BinaryReader): ElfSegment {
            var type = br.ReadUint32(),
                offset = br.ReadUint32(),
                vAddr = br.ReadUint32(),
                pAddr = br.ReadInt32(),
                fSize = br.ReadUint32(),
                mSize = br.ReadUint32(),
                flags = br.ReadUint32(),
                align = br.ReadUint32();
            // Read segment bytes beginning at file offset read above.
            var oldPos = br.Seek(offset);
            var bytes = br.ReadBytes(fSize);
            // Pad with 0 bytes if memory size is larger than file size.
            for (var i = fSize; i < mSize; i++)
                bytes.push(0);
            br.Seek(oldPos);
            return new ElfSegment(type, offset, vAddr, pAddr, fSize, mSize, flags, align, bytes);
        }
    }
}