///<reference path="Util.ts"/>

module ARM.Assembler {
    /**
     * Represents a literal pool into that can be used to store constant values inside
     * code sections.
     */
    export class Litpool {
        private literals = {};
        private size = 0;

        get Size() {
            return this.size;
        }

        Put(value: number) {
        }

        Get(value: number) {
          
        }
    }
}