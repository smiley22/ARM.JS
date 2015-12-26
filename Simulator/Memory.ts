module ARM.Simulator {
    /**
     * Simulates a memory interface that provides 4GB of linear addressing space.
     */
    export class Memory {
        private regions: Array<Region>;

        /**
         * Initializes a new instance of the Memory class.
         *
         * @param regions
         *  An array of regions to map into the address space.
         */
        constructor(regions?: Array<Region>) {
            if (regions)
                this.regions = regions;
        }

        /**
         * Maps the specified region into the address space.
         *
         * @param {Region} region
         *  The region to map into the address space.
         * @return {boolean}
         *  True if the section was mapped into the address space; Otherwise false.
         */
        Map(region: Region) {
            if (this.regions.some(v => Region.Intersect(region, v)))
                return false;
            this.regions.push(region);
            return true;
        }

        /**
         * Unmaps the specified region from the address space.
         *
         * @param {Region} region
         *  The region to unmap.
         * @return {boolean}
         *  True if the region was unmapped; Otherwise false.
         */
        Unmap(region: Region): boolean {
            for (var i = 0; i < this.regions.length; i++) {
                if (region == this.regions[i]) {
                    this.regions.splice(i, 1);
                    return true;
                }
            }
            return false;
        }

        /**
         * Reads the specified quantity of data from the specified memory address.
         *
         * @param {number} address
         *  The memory address from which to read the data.
         * @param {DataType} type
         *  The quantity of data to read.
         * @return {number}
         *  The read data.
         * @exception
         *  An abort was signaled and the memory access could not be completed.
         * @remarks
         *  All data values must be aligned on their natural boundaries. All words must be
         *  word-aligned. When a word access is signaled the memory system ignores the bottom
         *  two bits, and when a halfword access is signaled the memory system ignores the
         *  bottom bit.
         */
        Read(address: number, type: DataType): number {
            if (type == DataType.Word)
                address = (address & 0xFFFFFFFC).toUint32();
            else if (type == DataType.Halfword)
                address = (address & 0xFFFFFFFE).toUint32();
            for (var i = 0; i < this.regions.length; i++) {
                var r = this.regions[i];
                if (address < r.Base || address >= (r.Base + r.Size))
                    continue;
                var value = r.Read(address - r.Base, type);
                if (type == DataType.Halfword)
                    return value & 0xFFFF;
                if (type == DataType.Byte)
                    return value & 0xFF;
                return value;
            }
            throw new Error('BadAddress');
        }

        /**
         * Writes the specified quantity of data to the specified memory address.
         *
         * @param {number} address
         *  The memory address to which the data will be written.
         * @param {DataType} type
         *  The quantity of data to write.
         * @param {number} value
         *  The contents of the data.
         * @exception
         *  An abort was signaled and the memory access could not be completed.
         * @remarks
         *  All data values must be aligned on their natural boundaries. All words must be
         *  word-aligned. When a word access is signaled the memory system ignores the bottom
         *  two bits, and when a halfword access is signaled the memory system ignores the
         *  bottom bit.
         */
        Write(address: number, type: DataType, value: number) {
            switch (type) {
                case DataType.Word:
                    address = (address & 0xFFFFFFFC).toUint32();
                    break;
                case DataType.Halfword:
                    address = (address & 0xFFFFFFFE).toUint32();
                    value &= 0xFFFF;
                    break;
                case DataType.Byte:
                    value &= 0xFF;
                    break;
            }
            for (var i = 0; i < this.regions.length; i++) {
                var r = this.regions[i];
                if (address < r.Base || address >= (r.Base + r.Size))
                    continue;
                r.Write(address - r.Base, type, value);
                return;
            }
            throw new Error('BadAddress');
        }
    }
}

