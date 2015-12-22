module ARM.Simulator {
    /**
     * Represents an ARM7-like processor that implements the ARMv4T instruction set architecture.
     */
    export class Cpu {
        /**
         * The program status register of the processor.
         */
        private cpsr = new Cpsr();

        /**
         * The 16 general-purpose registers R0 to R15 of the processor.
         */
        private gpr = new Array<number>(0x10);

        /**
         * The clock rate of the processor, in Hertz.
         */
        private clockRate: number;

        /**
         * The total number of clock cycles the processor has run.
         */
        private cycles: number;

        /**
         * The total number of instructions the processor has executed.
         */
        private instructions: number;

        /**
         * True if an exception was raised during the execution of the last instruction.
         */
        private pendingException: boolean;

        /**
         * Gets the number of clock cycles the processor has run.
         */
        get Cycles(): number {
            return this.cycles;
        }

        /**
         * Gets the total number of instructions the processor has executed.
         */
        get Instructions(): number {
            return this.instructions;
        }

        constructor() {
            console.log("Hello");
        }
    }
}