///<reference path="ElfSegmentType.ts"/>
///<reference path="ElfSegmentFlag.ts"/>

module ARM.Simulator.Elf {
    /**
     * Represents a program-header entry of a 32-bit ELF file.
     */
    export class ElfSegment {
        /**
         * Specifies what kind of segment this program header element describes.
         */
        private type: ElfSegmentType;

        /**
         * The offset from the beginning of the file at which the first byte of the segment
         * resides.
         */
        private offset: number;

        /**
         * The virtual address at which the first byte of the segment resides in memory.
         */
        private virtualAddress: number;

        /**
         * On systems for which physical addressing is relevant, this member is reserved for the
         * segment's physical address.
         */
        private physicalAddress: number;

        /**
         * The number of bytes in the file image of the segment; it may be zero.
         */
        private fileSize: number;

        /**
         * The number of bytes in the memory image of the segment; it may be zero.
         */
        private memorySize: number;

        /**
         * The flags relevant to the segment.
         */
        private flags: ElfSegmentFlag;

        /**
         * The value to which the segments are aligned in memory and in the file.
         */
        private alignment: number;

        /**
         * The actual data bytes of the segment.
         */
        private bytes: number[];

        /**
         * Gets what kind of segment this program header element describes.
         *
         * @return {ElfSegmentType}
         *  The type of segment this program header element describes.
         */
        get Type() {
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
        get Offset() {
            return this.offset;
        }

        /**
         * Gets the virtual address at which the first byte of the segment resides in memory.
         *
         * @return {number}
         *  The virtual address at which the first byte of the segment resides in memory.
         */
        get VirtualAddress() {
            return this.virtualAddress;
        }

        /**
         * Gets the physical address at which the first byte of the segment resides in memory.
         *
         * @return {number}
         *  The physical address at which the first byte of the segment resides in memory.
         */
        get PhysicalAddress() {
            return this.physicalAddress;
        }

        /**
         * Gets the number of bytes in the file image of the segment.
         *
         * @return {number}
         *  The number of bytes in the file image of the segment; it may be zero.
         */
        get FileSize() {
            return this.fileSize;
        }

        /**
         * Gets the number of bytes in the memory image of the segment.
         *
         * @return {number}
         *  The number of bytes in the memory image of the segment; it may be zero.
         */
        get MemorySize() {
            return this.memorySize;
        }

        /**
         * Gets the flags relevant to the segment.
         *
         * @return {ElfSegmentFlag}
         *  The flags relevant to the segment.
         */
        get Flags() {
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
        get Alignment() {
            return this.alignment;
        }

        /**
         * Gets the data bytes of the segment.
         *
         * @return {number}
         *  The data bytes of the segment.
         */
        get Bytes() {
            return this.bytes;
        }

        /**
         * Initializes a new instance of the ElfSegment class using the specified values.
         *
         * @param type
         *  The type of the segment.
         * @param offset
         *  The offset from the beginning of the file at which the first byte of the segment
         *  resides.
         * @param vAddr
         *  The virtual address at which the first byte of the segment resides in memory.
         * @param pAddr
         *  On systems for which physical addressing is relevant, this member is reserved for the
         *  segment's physical address.
         * @param fileSize
         *  The number of bytes in the file image of the segment; it may be zero.
         * @param memorySize
         *  The number of bytes in the memory image of the segment; it may be zero.
         * @param flags
         *  The flags relevant to the segment.
         * @param alignment
         *  The value to which the segments are aligned in memory and in the file.
         * @param bytes
         *  The data bytes of the segment.
         */
        constructor(type: ElfSegmentType, offset: number, vAddr: number, pAddr: number,
            fileSize: number, memorySize: number, flags: number, alignment: number, bytes: number[]) {
            this.type = type;
            this.offset = offset;
            this.virtualAddress = vAddr;
            this.physicalAddress = pAddr;
            this.fileSize = fileSize;
            this.memorySize = memorySize;
            this.flags = flags;
            this.alignment = alignment;
            this.bytes = bytes;
        }
    }
}