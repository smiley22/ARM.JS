module ARM.Simulator {
    /**
     * A class for reading primitive data types as binary values from an underlying buffer.
     */
    export class BinaryReader {
        /**
         * The underlying data buffer.
         */
        private data: number[];

        /**
         * The current position in the data buffer.
         */
        private pos = 0;

        /**
         * Gets the current position in the underlying data buffer.
         */
        public get Position() {
            return this.pos;
        }

        /**
         * Initializes a new instance of the BinaryReader class.
         *
         * @param data
         *  The data buffer from which to read.
         */
        constructor(data: number[]) {
            this.data = data;
        }

        /**
         * Reads an unsigned byte from the data buffer and advances the current position.
         *
         * @returns {number}
         *  The next byte read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadUint8(): number {
            if (this.pos >= this.data.length)
                throw new Error('Eof');
            return this.data[this.pos++];
        }

        /**
         * Reads an unsigned short from the data buffer and advances the current position.
         *
         * @param {boolean} bigEndian
         *  true to read the short value as big-endian; otherwise false.
         * @returns {number}
         *  The next unsigned short read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadUint16(bigEndian = false): number {
            if ((this.pos + 1) >= this.data.length)
                throw new Error('Eof');
            var val = 0;
            if (bigEndian) {
                for (let i = 1; i >= 0; i--)
                    val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
            } else {
                for (let i = 0; i < 2; i++)
                    val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
            }
            return val;
        }

        /**
         * Reads an unsigned integer from the data buffer and advances the current position.
         *
         * @param {boolean} bigEndian
         *  true to read the int value as big-endian; otherwise false.
         * @returns {number}
         *  The next unsigned integer read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadUint32(bigEndian = false): number {
            if ((this.pos + 3) >= this.data.length)
                throw new Error('Eof');
            var val = 0;
            if (bigEndian) {
                for (let i = 3; i >= 0; i--)
                    val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
            } else {
                for (let i = 0; i < 4; i++)
                    val = val + ((this.data[this.pos++] << (8 * i)) >>> 0);
            }
            return val;
        }

        /**
         * Reads a signed byte from the data buffer and advances the current position.
         *
         * @returns {number}
         *  The next byte read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadInt8(): number {
            if (this.pos >= this.data.length)
                throw new Error('Eof');
            return Util.SignExtend(this.data[this.pos++], 8, 32);
        }

        /**
         * Reads a signed short from the data buffer and advances the current position.
         *
         * @param {boolean} bigEndian
         *  true to read the short value as big-endian; otherwise false.
         * @returns {number}
         *  The next signed short read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadInt16(bigEndian = false): number {
            if ((this.pos + 1) >= this.data.length)
                throw new Error('Eof');
            var val = 0;
            if (bigEndian) {
                for (let i = 1; i >= 0; i--)
                    val = val + (this.data[this.pos++] << (8 * i));
            } else {
                for (let i = 0; i < 2; i++)
                    val = val + (this.data[this.pos++] << (8 * i));
            }
            return Util.SignExtend(val, 16, 32);
        }

        /**
         * Reads a signed integer from the data buffer and advances the current position.
         *
         * @param {boolean} bigEndian
         *  true to read the integer value as big-endian; otherwise false.
         * @returns {number}
         *  The next signed integer read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadInt32(bigEndian = false): number {
            if ((this.pos + 3) >= this.data.length)
                throw new Error('Eof');
            var val = 0;
            if (bigEndian) {
                for (let i = 3; i >= 0; i--)
                    val = val | (this.data[this.pos++] << (8 * i));
            } else {
                for (let i = 0; i < 4; i++)
                    val = val | (this.data[this.pos++] << (8 * i));
            }
            return val;
        }

        /**
         * Seeks to the specified position in the underlying data buffer.
         *
         * @param position
         *  The position to seek to.
         * @throws 'Eof'
         *  The position parameter is outside the bounds of the underlying data buffer.
         * @returns {number}
         *  The old position.
         */
        public Seek(position: number): number {
            if (position < 0 || position >= this.data.length)
                throw new Error('Eof');
            var prev = this.pos;
            this.pos = position;
            return prev;
        }

        /**
         * Reads the specified number of bytes from the underlying data buffer and advances the
         * position.
         *
         * @param count
         *  The number of bytes to read from the data buffer.
         * @throws 'Eof'
         *  The end of the data buffer is reached.
         */
        public ReadBytes(count: number): number[] {
            var r = [];
            for (var i = 0; i < count; i++)
                r.push(this.ReadUint8());
            return r;
        }
    }
}
