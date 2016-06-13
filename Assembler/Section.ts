///<reference path="Util.ts"/>

module ARM.Assembler {
    /**
     * Represents a section into which code is assembled.
     */
    export class Section {
        private committed = false;
        private name;
        private size = 0;
        private pos = 0;
        private buffer: ArrayBuffer = null;
        private uint8view: Uint8Array = null;
        private uint16view: Uint16Array = null;
        private uint32view: Uint32Array = null;

        /**
         * Gets the name of the section.
         * 
         * @return {string}
         *  The name of the section.
         */
        get Name() {
            return this.name;
        }

        /**
         * Gets the size of the section, in bytes.
         * 
         * @return {string}
         *  The size of the section, in bytes.
         */
        get Size() {
            return this.size;
        }

        /**
         * Gets the section pointer.
         * 
         * @return {string}
         *  The section pointer.
         */
        get Position() {
            return this.pos;
        }

        /**
         * Gets the underlying data buffer.
         * 
         * @returns {ArrayBuffer}
         *  The underlying data buffer of the section.
         */
        get Buffer() {
            return this.buffer;
        }

        /**
         * Initializes a new section with the specified name.
         * 
         * @param {string} name
         *  The name of the section.
         */
        constructor(name: string) {
            this.name = name;
        }

        /**
         * Grows the section by the specified number of bytes.
         * 
         * @param {number} numBytes
         *  The number of bytes to grow the section.
         */
        Grow(numBytes: number) {
            if (this.committed)
                throw new Error('Section has already been committed');
            this.size = this.size + numBytes;
        }

        /**
         * Commits the section, i.e. allocates a fixed portion of memory for the section's
         * content.
         */
        Commit() {
            // Ensure section size is always a multiple of 4.
            var align = 4;
            if (this.size % align)
                this.Grow(align - (this.size % align));
            // Allocate memory and map views.
            this.buffer = new ArrayBuffer(this.size);
            this.uint8view = new Uint8Array(this.buffer);
            this.uint16view = new Uint16Array(this.buffer);
            this.uint32view = new Uint32Array(this.buffer);
            this.committed = true;
            this.pos = 0;
        }

        /**
         * Writes the specified data to the section.
         * 
         * @param {number} value
         *  The data value to write.
         * @param {string} type
         *  The data-type of the value that is being written.
         */
        Write(value: number, type: string) {
            if (!this.committed)
                throw new Error('Section has not been committed');
            let sizes = { 'BYTE': 1, 'HWORD': 2, 'WORD': 4, '2BYTE': 2, '4BYTE': 4 },
                view = null;
            switch (type) {
                case 'BYTE':
                    view = new Uint8Array(this.buffer);
                    break;
                case 'HWORD':
                case '2BYTE':
                    view = new Uint16Array(this.buffer);
                    break;
                case 'WORD':
                case '4BYTE':
                    view = new Uint32Array(this.buffer);
                    break;
                default:
                    throw new Error(`Invalid data type ${type}`);
            }
            let index = this.pos;
            if ((index % sizes[type]) != 0)
                throw new Error(`Trying to write ${type} value at un-aligned offset ${index}`);
            index = index / sizes[type];
            view[index] = value;
            this.pos += sizes[type];
        }
    }
}