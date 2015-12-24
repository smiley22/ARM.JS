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
         * The delegate invoked by the processor for reading from memory.
         *
         * @param {number} address
         *  The memory address at which to perform the read.
         * @param {DataType} type
         *  The quantity to read.
         * @return {number}
         *  The read data.
         * @remarks
         *  Memory accesses should be aligned with respect to the specified data type, that is
         *  32-bit words must only be read from addresses that are multiples of four and 16-bit
         *  halfwords must only be read from addresses that are multiples of two.
         */
        private Read: (address: number, type: DataType) => number;

        /**
         * The delegate invoked by the processor for writing to memory.
         *
         * @param {number} address
         *  The memory address at which to perform the write.
         * @param {DataType} type
         *  The quantity to write.
         * @remarks
         *  Memory accesses should be aligned with respect to the specified data type, that is
         *  32-bit words must only be written to addresses that are multiples of four and 16-bit
         *  halfwords must only be written to addresses that are multiples of two.
         */
        private Write: (address: number, type: DataType, value: number) => void;

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

        /**
         * Initializes a new instance of the Cpu class.
         *
         * @param {number} clockRate
         *  The clock rate of the processor, in MHz.
         * @param read
         *  The delegate invoked by the processor for reading from memory.
         * @param write
         *  The delegate invoked by the processor for writing to memory.
         */
        constructor(
            clockRate: number,
            read: (address: number, type: DataType) => number,
            write: (address: number, type: DataType, value: number) => void) {
            // Save clock rate as Hz.
            this.clockRate = clockRate * 1000000;
            this.Read = read;
            this.Write = write;

            this.RaiseException(CpuException.Reset);
        }

        /**
         * Single-steps the CPU, that is, fetches and executes a single instruction.
         *
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        Step(): number {
            var cycles = 1;
            // Fetch instruction word.
            var iw = this.Read(this.pc, DataType.Word);
            // Evaluate condition code.
            var cond = (iw >> 28) & 0xF;
            if (this.CheckCondition(cond)) {
                // Retrieve key into dispatch table.
                var exec = this.Decode(iw);
                // The PC value used in an executing instruction is always two instructions ahead
                // of the actual instruction address because of pipelining.
                this.pc = this.pc + 8;
                // Dispatch instruction.
                var beforeInstruction = this.pc;
                cycles = exec(iw);
                this.cycles = this.cycles + cycles;
                this.instructions++;
                // Move on to next instruction, unless executed instruction was a branch which
                // means a pipeline flush, or the instruction raised an exception and altered
                // the PC.
                if (this.pc == beforeInstruction)
                    this.pc = this.pc - 4;
            } else {
                // Skip over instruction.
                this.pc = this.pc + 4;
            }
            return cycles;
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
        }

        /**
         * Decodes the specified ARM instruction set word.
         *
         * @param {number} iw
         *  The 32-bit ARM instruction set word to encode.
         * @return
         *  A delegate to the handler method implementing the instruction contained in the
         *  specified instruction set word.
         * @remarks
         *  Refer to the 'ARM instruction set encoding' section in the ARM Architecture Reference
         *  Manual to understand the bit patterns used in this method.
         */
        private Decode(iw: number): ((iw: number) => number) {
            switch ((iw >> 25) & 0x07) {
                case 0:
                    if (!(((iw >> 4) & 0x1FFFFF) ^ 0x12FFF1))
                        return this.bx;
                    var b74 = (iw >> 4) & 0xF;
                    if (b74 == 9)
                        return ((iw >> 24) & 0x01) ? this.swi :
                            (((iw >> 23) & 0x01) ? this.mull_mlal : this.mul_mla);
                    if (b74 == 0xB || b74 == 0xD || b74 == 0xF)
                        return this.ldrh_strh_ldrsb_ldrsh;
                    if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
                        return ((iw >> 21) & 0x01) ? this.msr : this.mrs;
                    return this.data;
                case 1:
                    if (((iw >> 23) & 0x03) == 2 && !((iw >> 20) & 0x01))
                        return ((iw >> 21) & 0x01) ? this.msr : this.mrs;
                    return this.data;
                case 2: return this.ldr_str;
                case 3: return ((iw >> 4) & 0x01) ? this.undefined : this.ldr_str;
                case 4: return this.ldm_stm;
                case 5: return this.b_bl;
                case 6: return this.ldc_stc;
                case 7:
                    if ((iw >> 24) & 0x01)
                        return this.swi;
                    return ((iw >> 4) & 0x01) ? this.mrc_mcr : this.cdp;
            }
        }
        
        /**
         * Implements the 'Branch and Exchange' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private bx(iw: number): number {
            var addr = this.gpr[iw & 0xF];
            if (addr & 0x01)
                throw new Error('THUMB mode is not supported.');
            this.pc = addr;
            return 3;
        }

        /**
         * Implements the 'Branch and branch with link' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private b_bl(iw: number): number {
            var offset = Util.SignExtend((iw & 0xFFFFFF) << 2, 26, 32);
            if ((iw >> 24) & 0x01)
                this.gpr[14] = this.pc - 4;
            this.pc = this.pc + offset;
            return 3;
        }

        /**
         * Implements the 'Software Interrupt' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private swi(iw: number): number {
            if (!this.cpsr.I)
                this.RaiseException(CpuException.Software);
            return 3;
        }

        private mrs(iw: number): number {
            return 1234;
        }

        private msr(iw: number): number {
            return 1234;
        }

        /**
         * Implements the 'Swap' and 'Swap Byte' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private swp(iw: number): number {
            var b  = (iw >> 22) & 0x1,
                rn = (iw >> 16) & 0xF,
                rd = (iw >> 12) & 0xF,
                rm = iw & 0xF,
                cy = 2, // Cycles spent.
                dt = b == 1 ? DataType.Byte : DataType.Word;
            try {
                var c = this.Read(this.gpr[rn], dt);
                cy++;
                this.Write(this.gpr[rn], dt, this.gpr[rm]);
                cy++;
                this.gpr[rd] = c;
            } catch (e) {
                // No strongly-typed catch in TypeScript, so this is the best we can do.
                if (e.Message == 'BadAddress')
                    this.RaiseException(CpuException.Data);
                else
                    throw e;
            }
            return cy;
        }

        /**
         * Implements the 'Coprocessor Data Processing' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private cdp(iw: number): number {
            var opc = (iw >> 20) & 0xF,
                cRn = (iw >> 16) & 0xF,
                cRd = (iw >> 12) & 0xF,
                cNo = (iw >>  8) & 0xF,
                cp  = (iw >>  5) & 0x7,
                cRm = iw & 0xF;
            // FIXME: Implement some mechanism for registering coprocessors and then pass on
            // the instruction.
            // Any coprocessor instructions that are not implemented cause an undefined
            // instruction trap.
            this.RaiseException(CpuException.Undefined);
            return 1;
        }

        private data(iw: number): number {
            return 1234;
        }

        private ldr_str(iw: number): number {
            return 1234;
        }

        private ldm_stm(iw: number): number {
            return 1234;
        }

        /**
         * Implements the 'Load Coprocessor' and 'Store Coprocessor' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private ldc_stc(iw: number): number {
            var p   = (iw >> 24) & 0x1,
                u   = (iw >> 23) & 0x1,
                n   = (iw >> 22) & 0x1,
                w   = (iw >> 21) & 0x1,
                l   = (iw >> 20) & 0x1,
                rn  = (iw >> 16) & 0xF,
                cRd = (iw >> 12) & 0xF,
                cNo = (iw >>  8) & 0xF,
                ofs = iw & 0xFF;
            // See FIXME comment for CDP instruction.
            this.RaiseException(CpuException.Undefined);
            return 2;
        }

        /**
         * Implements the 'Move to ARM Register from Coprocessor' and 'Move to Coprocessor from
         * ARM Register' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private mrc_mcr(iw: number): number {
            var opc = (iw >> 21) & 0x7,
                l   = (iw >> 20) & 0x1,
                cRn = (iw >> 16) & 0xF,
                rd  = (iw >> 12) & 0xF,
                cNo = (iw >>  8) & 0xF,
                cp  = (iw >>  5) & 0x7,
                cRm = iw & 0xF;
            // See FIXME comment for CDP instruction.
            this.RaiseException(CpuException.Undefined);
            return 2;
        }

        private mul_mla(iw: number): number {
            return 1234;
        }

        private mull_mlal(iw: number): number {
            return 1234;
        }

        private ldrh_strh_ldrsb_ldrsh(iw: number): number {
            return 1234;
        }

        /**
         * Implements the 'Undefined' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private undefined(iw: number): number {
            if (!this.cpsr.I)
                this.RaiseException(CpuException.Undefined);
            return 3;
        }
    }
}