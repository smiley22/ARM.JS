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
         * The banked registers of the different operating modes.
         */
        private banked = {
            0x10: { 8: 0, 9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 },
            0x11: {  8: 0,  9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, SPSR: 0 },
            0x12: { 13: 0, 14: 0, SPSR: 0 },
            0x13: { 13: 0, 14: 0, SPSR: 0 },
            0x17: { 13: 0, 14: 0, SPSR: 0 },
            0x1B: { 13: 0, 14: 0, SPSR: 0 }
            // System and User share banked registers
        };

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
            this.CheckCondition(100);
        }

        /**
         * Evaluates the specified condition.
         *
         * @param {Condition} c
         *  The condition to evaluate.
         * @return {boolean}
         *  The result of the evaluation, that is, true or false.
         * @exception
         *  The condition is Condition.NV, or you dodged TypeScript's type system.
         */
        private CheckCondition(c: Condition): boolean {
            var s = true;
            switch (c) {
                case Condition.EQ: s =  this.cpsr.Z;
                case Condition.NE: s = !this.cpsr.Z;
                case Condition.CS: s =  this.cpsr.C;
                case Condition.CC: s = !this.cpsr.C;
                case Condition.MI: s =  this.cpsr.N;
                case Condition.PL: s = !this.cpsr.N;
                case Condition.VS: s =  this.cpsr.V;
                case Condition.VC: s = !this.cpsr.V;
                case Condition.HI: s = !this.cpsr.Z && this.cpsr.C;
                case Condition.LS: s = !this.cpsr.C || this.cpsr.Z;
                case Condition.GE: s =  this.cpsr.N == this.cpsr.V;
                case Condition.LT: s =  this.cpsr.N != this.cpsr.V;
                case Condition.GT: s = !this.cpsr.Z && (this.cpsr.N == this.cpsr.V);
                case Condition.LE: s =  this.cpsr.Z || (this.cpsr.N != this.cpsr.V);
                case Condition.AL: s = true;
                // Undetermined, but let's be nice and throw an exception.
                default:
                    throw new Error('Invalid condition code ' + c);
            }
            return s;
        }

        /**
         * Switches the processor to the specified operating mode.
         *
         * @param {CpuMode} mode
         *  The operating mode to switch the processor to.
         */
        private SwitchMode(mode: CpuMode): void {
            // System mode shares the same registers as User mode.
            var curBank = this.cpsr.Mode == CpuMode.System ?
                CpuMode.User : this.cpsr.Mode;
            var newBank = mode == CpuMode.System ?
                CpuMode.User : mode;
            // Save current registers and load banked registers.
            if (curBank != newBank) {
                var o = this.banked[curBank];
                var n = this.banked[newBank];
                for (var r in n) {
                    if (r == 'SPSR') {
                        n[r] = this.cpsr;
                        continue;
                    }
                    if (typeof o[r] != 'undefined')
                        o[r] = this.gpr[r];
                    this.gpr[r] = n[r];
                }
            }
            // Set new operating mode.
            this.cpsr.Mode = mode;
        }

        /**
         * Raises the specified CPU exception.
         *
         * @param {CpuException} e
         *  The exception to raise.
         */
        private RaiseException(e: CpuException): void {
        }
    }
}