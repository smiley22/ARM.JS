///<reference path="DataType.ts"/>

module ARM.Simulator {
    /**
     * Represents a continuous region of memory.
     */
    export class Region {
        /**
         * The base address of the region in the 32-bit address space.
         */
        private base: number;

        /**
         * The size of the region, in bytes.
         */
        private size: number;

        /**
         * The backing storage for the region, if needed.
         */
        private buffer: ArrayBuffer;

        /**
         * Provides a byte-view for the backing storage.
         */
        private u8: Uint8Array;

        /**
         * Provides a short-view for the backing storage.
         */
        private u16: Uint16Array;

        /**
         * Provides a word-view for the backing storage.
         */
        private u32: Uint32Array;

        /**
         * The delegate to invoke when data is read from the region.
         */
        private read: (address: number, type: DataType) => number;

        /**
         * The delegate to invoke when data is written to the region.
         */
        private write: (address: number, type: DataType, value: number) => void;

        /**
         * Determines whether the specified regions intersect.
         *
         * @param {Region} a
         *  The first region.
         * @param {Region} b
         *  The second region.
         * @return {boolean}
         *  True if the regions intersect; Otherwise false.
         */
        static Intersect(a: Region, b: Region): boolean {
            var a_start = a.base,
                a_end = a.base + a.size,
                b_start = b.base,
                b_end = b.base + b.size;
            if (a_end < b_start || a_start > b_end)
                return false;
            return true;
        }

        /**
         * Can be used to specify a region that does not support reads from memory.
         *
         * @param {number} address
         *  The address from which to read, relative to the regions's base address.
         * @param {DataType} type
         *  The quantity of data to read.
         * @return {number}
         *  The read data.
         * @exception
         *  The memory read could not be completed.
         * @remarks
         *  This method always throws a 'BadAddress' exception.
         */
        static NoRead(address: number, type: DataType): number {
            throw new Error('BadAddress');
        }

        /**
         * Can be used to specify a region that does not support writes to memory.
         *
         * @param {number} address
         *  The address to write to, relative to the region's base address.
         * @param {DataType} type
         *  The quantity of data to write.
         * @param {number} value
         *  The data to write.
         * @exception
         *  The memory write could not be completed.
         * @remarks
         *  This method always throws a 'BadAddress' exception.
         */
        static NoWrite(address: number, type: DataType, value: number): void {
            throw new Error('BadAddress');
        }

        /**
         * Gets the base address of the region.
         */
        get Base() {
            return this.base;
        }

        /**
         * Gets the size of the region, in bytes.
         */
        get Size() {
            return this.size;
        }

        /**
         * Gets the delegate to invoke for reading from the region.
         */
        get Read() {
            return this.read;
        }

        /**
         * Gets the delegate to invoke for writing to the region.
         */
        get Write() {
            return this.write;
        }

        /**
         * Initializes a new instance of the Region class.
         * 
         * @param base
         *  The base address of the region in the 32-bit address space.
         * @param size
         *  The size of the region, in bytes.
         * @param read
         *  The delegate to invoke for reading from the region, or null to create a
         *  backing-storage based region.
         * @param write
         *  The delegate to invoke for writing to the region, or null to create a backing-storage
         *  based region.
         * @param image
         *  An array of bytes to initialize the region with, if a backing-storage region is
         *  being created; otherwise this parameter is ignored.
         */
        constructor(base: number, size: number,
            read?: (address: number, type: DataType) => number,
            write?: (address: number, type: DataType, value: number) => void,
            image?: number[]) {
            this.base = base;
            this.size = size;
            this.read = read || this.BufferRead;
            this.write = write || this.BufferWrite;
            if (!read || !write)
                this.InitBuffers(size, image);
        }

        /**
         * Implements memory reads for backing-storage based regions.
         *
         * @param {number} address
         *  The address from which to read, relative to the regions's base address.
         * @param {DataType} type
         *  The quantity of data to read.
         * @return {number}
         *  The read data.
         */
        private BufferRead(address: number, type: DataType): number {
            switch (type) {
                case DataType.Byte:
                    return this.u8[address];
                case DataType.Halfword:
                    return this.u16[address / 2];
                case DataType.Word:
                default:
                    return this.u32[address / 4];
            }
        }

        /**
         * Implements memory writes for backing-storage based regions.
         *
         * @param {number} address
         *  The address to write to, relative to the region's base address.
         * @param {DataType} type
         *  The quantity of data to write.
         * @param {number} value
         *  The data to write.
         */
        private BufferWrite(address: number, type: DataType, value: number): void {
            switch (type) {
                case DataType.Byte:
                    this.u8[address] = value;
                case DataType.Halfword:
                    this.u16[address / 2] = value;
                case DataType.Word:
                default:
                    this.u32[address / 4] = value;
            }
        }

        /**
         * Initializes the backing-storage and views.
         *
         * @param size
         *  The size of the region, in bytes.
         * @param image
         *  A binary image to initialize the buffer's contents with.
         */
        private InitBuffers(size: number, image?: number[]): void {
            this.buffer = new ArrayBuffer(size);
            this.u8 = new Uint8Array(this.buffer);
            this.u16 = new Uint16Array(this.buffer);
            this.u32 = new Uint32Array(this.buffer);
            if (image)
                this.u8.set(image);
        }
    }
}