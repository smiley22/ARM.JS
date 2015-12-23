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
         * The 16 general registers R0 to R15 of the processor.
         *
         * @remarks
         *  Register R14 is used as the subroutine Link Register (LR) and register R15 holds the
         *  Program Counter (PC). By convention, register R13 is used as the Stack Pointer (SP).
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
         *
         * @remarks
         *  Banked registers are discrete physical registers in the core that are mapped to the
         *  available registers depending on the current processor operating mode.
         */
        private banked = {
            0x10: {  8: 0,  9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0 },
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
         * Gets whether the processor is operating in a privileged mode.
         *
         * @return {boolean}
         *  True if the processor is operating in a privileged mode; otherwise false.
         */
        private get privileged(): boolean {
            return this.cpsr.Mode != CpuMode.User;
        }

        /**
         * Sets the program counter to the specified memory address.
         *
         * @param {number} v
         *  The memory address to set the program counter to.
         * @exception
         *  The specified memory address is not aligned on a 32-bit word boundary.
         */
        private set pc(v: number) {
            if (v % 4)
                throw new Error('Unaligned memory address ' + v.toHex());
            this.gpr[15] = v;
        }

        /**
         * Gets the program counter.
         *
         * @return {number}
         *  The contents of the program counter register of the processor.
         */
        private get pc(): number {
            return this.gpr[15];
        }

        /**
         * Sets the operating state of the processor to the specified state.
         *
         * @param {CpuState} s
         *  The state to set the processor to.
         */
        private set state(s: CpuState) {
            this.cpsr.T = s == CpuState.Thumb;
        }

        /**
         * Gets the current operating state of the processor.
         *
         * @return {CpuState}
         *  The current operating state of the processor.
         */
        private get state(): CpuState {
            return this.cpsr.T ? CpuState.Thumb : CpuState.ARM;
        }

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
                        // FIXME: fix SPSR save and restore.
                        n[r] = this.cpsr.ToWord();
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
            var mode = [CpuMode.Supervisor, CpuMode.Undefined, CpuMode.Supervisor, CpuMode.Abort,
                CpuMode.Abort, null, CpuMode.IRQ, CpuMode.FIQ][e / 4];
            // Switch CPU to the designated mode specified for the respective exception.
            this.SwitchMode(mode);
            // Disable interrupts.
            this.cpsr.I = true;
            // FIQ is only disabled on power-up and for FIQ interrupts. Otherwise it remains
            // unchanged.
            if (e == CpuException.Reset || e == CpuException.FIQ)
                this.cpsr.F = true;
            this.state = CpuState.ARM;
            this.pc = e;
            // RESET is special in that it only happens directly on power-up so we treat it
            // a bit differently.
            this.pendingException = e != CpuException.Reset;
        }
    }
}