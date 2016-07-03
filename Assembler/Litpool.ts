///<reference path="Util.ts"/>

module ARM.Assembler {
    /**
     * Represents a literal pool into that can be used to store constant values inside
     * code sections.
     */
    export class Litpool {
        private literals = {};
        private size = 0;
        private base = 0;
        private position = 0;
        private section: Section;

        /**
         * The default size of literal pools, in bytes.
         */
        static DefaultSize = 0x1000;

        /**
         * Gets the base address of the literal pool.
         * 
         * @returns {number}
         *  The base address of the literal pool.
         */
        get Base() {
            return this.base;
        }

        /**
         * Gets the size of the literal pool, in bytes.
         * 
         * @returns {number}
         *  The size of the literal pool, in bytes.
         */
        get Size() {
            return this.size;
        }

        /**
         * Initializes a new instance of the Litpool class.
         * 
         * @param section
         *  The section to create the literal pool in.
         * @param base
         *  The offset into the section where the literal pool is situated.
         * @param size
         *  The size of the literal pool, in bytes. If this is omitted, the default size will
         *  be used.
         */
        constructor(section:Section, base: number, size?: number) {
            this.size = size || Litpool.DefaultSize;
            this.base = base;
            this.section = section;
            this.section.Grow(this.size);
        }

        /**
         * Stores the specified integer literal in the literal pool.
         * 
         * @param {number} value
         *  The integer literal to store in the literal pool.
         * @return {number}
         *  The offset at which the integer literal is stored in the literal pool.
         */
        Put(value: number): number {
            // If the value already been stored in the literal pool, just return the offset.
            if (this.literals[value])
                return this.literals[value];
            if (this.position >= this.size)
                throw new Error('Literal pool overflow.');
            let offset = this.base + this.position,
                view = new Uint32Array(this.section.Buffer),
                index = offset / 4;
            view[index] = value;
            this.literals[value] = offset;
            this.position = this.position + 4;
            return offset;
        }
    }
}