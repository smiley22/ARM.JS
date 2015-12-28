﻿module ARM.Simulator {
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
            0x11: {  8: 0,  9: 0, 10: 0, 11: 0, 12: 0, 13: 0, 14: 0, spsr: 0 },
            0x12: { 13: 0, 14: 0, spsr: 0 },
            0x13: { 13: 0, 14: 0, spsr: 0 },
            0x17: { 13: 0, 14: 0, spsr: 0 },
            0x1B: { 13: 0, 14: 0, spsr: 0 }
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
         * Sets the SPSR of the processor's current mode.
         *
         * @param {number} v
         *  The value to set the SPSR to.
         * @exception
         *  The processor is in User or System mode.
         */
        private set spsr(v: number) {
            if (this.Mode == CpuMode.User || this.Mode == CpuMode.System)
                return; // Unpredictable as per spec.
            this.banked[this.Mode]['spsr'] = v;
        }

        /**
         * Gets the SPSR of the processor's current mode.
         *
         * @return {number}
         *  The SPSR of the processor's current mode.
         */
        private get spsr(): number {
            return this.banked[this.Mode]['spsr'];
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
         * Sets the value of the link register.
         *
         * @param {number} v
         *  The value to store in the link register.
         */
        private set lr(v: number) {
            this.gpr[14] = v;
        }

        /**
         * Gets the link register.
         *
         * @return {number}
         *  The contents of the link register of the processor's current mode.
         */
        private get lr(): number {
            return this.gpr[14];
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
         * Gets the operating mode of the processor.
         */
        get Mode(): CpuMode {
            return this.cpsr.Mode;
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
            // FIXME: Handle prefetch aborts.
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
                if (this.pc == beforeInstruction) // FIXME: Not sure we can really do this.
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
         * Loads the CPSR with the specified value.
         *
         * @param {number} value
         *  The value to load the CPSR with.
         * @remarks
         *  Loading the CPSR can potentially trigger a CPU mode switch and cause loading and
         *  storing of banked registers. The CPSR mode must only be modified through this method.
         */
        private LoadCpsr(value: number): void {
            var newCpsr = Cpsr.FromWord(value);
            if (newCpsr.T)
                throw new Error('THUMB mode is not supported.');
            // System mode shares the same registers as User mode.
            var curBank = this.Mode == CpuMode.System ? CpuMode.User : this.Mode;
            var newBank = newCpsr.Mode == CpuMode.System ? CpuMode.User : newCpsr.Mode;
            // Bank current registers and load banked registers of new mode.
            if (curBank != newBank) {
                var o = this.banked[curBank];
                var n = this.banked[newBank];
                for (var r in n) {
                    if (r == 'spsr') {
                        // FIXME: is CPSR always automatically banked to SPSR of new mode or
                        // only when a mode switch occurs as part of an exception.
                        n[r] = this.cpsr.ToWord();
                        continue;
                    }
                    if (typeof o[r] != 'undefined')
                        o[r] = this.gpr[r];
                    this.gpr[r] = n[r];
                }
            }
            this.cpsr = newCpsr;
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
            // Preserve the address of the next instruction in the appropriate LR.
            // The current PC value is 8 bytes ahead of the instruction currently being
            // executed.
            if (e != CpuException.Reset)
                this.lr = e == CpuException.Data ? this.pc : (this.pc - 4);
            // Setup new CPSR value.
            var newCpsr = Cpsr.FromPsr(this.cpsr);
            newCpsr.Mode = mode;
            // Disable interrupts.
            newCpsr.I = true;
            // FIQ is only disabled on power-up and for FIQ interrupts. Otherwise it remains
            // unchanged.
            if (e == CpuException.Reset || e == CpuException.FIQ)
                newCpsr.F = true;
            // Exceptions are always executed in ARM state.
            newCpsr.T = false;
            // Switch CPU to the respective mode and save the old CPSR to SPSR of new mode.
            this.LoadCpsr(newCpsr.ToWord());
            // Force the PC to fetch the next instruction from the relevant exception vector.
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
         * Gets the number of 8-bit multiplier array cycles required to complete a multiply
         * operation on the ARM7 processor.
         *
         * @param {number} m
         *  The multiplier operand specified in the Rs register for mul(l) instructions.
         * @return {number}
         *  The number of 8-bit multiplier array cycles required to complete the respective
         *  multiply operation.
         */
        private GetMultiplyCycles(m: number): number {
            var u = m.toUint32();
            if (u < 0xFF)
                return 1;
            if (u < 0xFFFF)
                return 2;
            if (u < 0xFFFFFF)
                return 3;
            return 4;
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
            this.RaiseException(CpuException.Software);
            return 3;
        }

        /**
         * Implements the 'Move PSR to General-purpose Register' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private mrs(iw: number): number {
            var p  = (iw >> 22) & 0x1,
                rd = (iw >> 12) & 0xF;
            if (p) {
                // Accessing the SPSR when in User mode or System mode is unpredictable. We'll
                // just do nothing in this case.
                if (this.spsr)
                    this.gpr[rd] = this.spsr;
            } else {
                this.gpr[rd] = this.cpsr.ToWord();
            }
            return 1;
        }

        /**
         * Implements the 'Move to Status Register from ARM Register' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private msr(iw: number): number {
            var i  = (iw >> 25) & 0x1,
                p  = (iw >> 22) & 0x1,
                a  = (iw >> 16) & 0x1, // 1 = All, 0 = Condition Code Flags only.
                v  = this.gpr[iw & 0xF],
                cy = 1; // Cycles spent.
            if (i) {
                // Operand is rotated immediate.
                var imm = iw & 0xFF,
                    rot = ((iw >> 8) & 0xF) * 2;
                v = Util.RotateRight(imm, rot);
                cy = cy + 1;
            }
            if (!this.privileged)
                a = 0;
            // Accessing SPSR when in User mode or in System mode is unpredictable. We'll just
            // ignore it.
            if (p && this.spsr) {
                if (a == 0) {
                    var t = this.spsr;
                    t &= ~0xF0000000;
                    t |= (v & 0xF0000000);
                    v = t;
                }
                this.spsr = v;
            } else {
                if (a == 0) {
                    var z = this.cpsr.ToWord();
                    z &= ~0xF0000000;
                    z |= (v & 0xF0000000);
                    v = z;
                }
                this.LoadCpsr(v);
            }
            return cy;
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

        /**
         * Implements the 16 data-processing instructions of the ARMv4T instruction set.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private data(iw: number): number {
            var ops = {
                0: this.and, 1: this.eor, 2: this.sub, 3: this.rsb, 4: this.add,
                5: this.adc, 6: this.sbc, 7: this.rsc, 8: this.tst, 9: this.teq,
                10: this.cmp, 11: this.cmn, 12: this.orr, 13: this.mov,
                14: this.bic, 15: this.mvn
            },
                opc = (iw >> 21) & 0xF, s = (iw >> 20) & 0x1, i = (iw >> 25) & 0x1,
                rn = (iw >> 16) & 0xF,
                rd = (iw >> 12) & 0xF,
                op2 = 0,
                cy = rd == 15 ? 2 : 1;
            if (i) {
                // Operand 2 is rotated immediate.
                op2 = Util.RotateRight(iw & 0xFF, ((iw >> 8) & 0xF) * 2);
            } else {
                // Operand 2 is shifted register.
                var rm = iw & 0xF, sh = (iw >> 4) & 0xFF, sOp = (sh >> 1) & 0x03, amt = 0,
                    sCOut = false; // Shifter Carry-Out.
                if (sh & 0x01) {
                    // Shift by register.
                    amt = this.gpr[(sh >> 4) & 0xF] & 0xF;
                    cy = cy + 1;
                } else {
                    // Shift by unsigned 5-bit immediate.
                    amt = (sh >> 3) & 0x1F;
                }
                // Perform shift operation sOp by amount amt on rm.
                switch (sOp) {
                    case 0: // LSL
                        op2 = this.gpr[rm] << amt;
                        sCOut = amt ? (((this.gpr[rm] >> (32 - amt)) & 0x01) == 1) : this.cpsr.C;
                        break;
                    case 1: // LSR
                        if (!amt)
                            amt = 32;
                        op2 = this.gpr[rm] >>> amt;
                        sCOut = ((this.gpr[rm] >>> (amt - 1)) & 0x01) == 1;
                        break;
                    case 2: // ASR
                        if (!amt)
                            amt = 32;
                        // >> is an arithmetic shift in Javascript.
                        op2 = this.gpr[rm] >> amt;
                        sCOut = ((this.gpr[rm] >>> (amt - 1)) & 0x01) == 1;
                        break;
                    case 3: // ROR
                        // amt == 0: RRX
                        if (!amt) {
                            op2 = ((this.cpsr.C ? 1 : 0) << 31) | (this.gpr[rm] >>> 1);
                            sCOut = (this.gpr[rm] & 0x01) == 1;
                        } else {
                            op2 = Util.RotateRight(this.gpr[rm], amt);
                            sCOut = ((this.gpr[rm] >>> (amt - 1)) & 0x01) == 1;
                        }
                        break;
                }
                // Set CPSR C flag to barrel-shifter carry-out for logical operations.
                var logicalOps = { 0: 1, 1: 1, 8: 1, 9: 1, 12: 1, 13: 1, 14: 1, 15: 1 };
                if (s == 1 && logicalOps[opc])
                    this.cpsr.C = sCOut;
            }
            // Dispatch to method for respective data instruction.
            ops[opc].call(this, this.gpr[rn], op2, rd, s == 1 && rd != 15);
            // Some operations can be used to copy the SPSR of the current mode to the CPSR.
            var copySpsr = { 0:1, 1:1, 2:1, 3:1, 4:1, 5:1, 6:1, 7:1, 12:1, 13:1, 14:1, 15:1 };
            if (s == 1 && rd == 15 && copySpsr[opc] && this.spsr)
                this.LoadCpsr(this.spsr);
            return cy;
        }

        /**
         * Implements the 'Bitwise AND' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private and(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (op1 & op2).toUint32();
            if (s) {
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Exclusive OR' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private eor(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (op1 ^ op2).toUint32();
            if (s) {
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Subtract' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private sub(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (op1 - op2).toUint32();
            if (s) {
                this.cpsr.C = this.gpr[rd] <= op1;
                this.cpsr.V = ((op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Reverse Subtract' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private rsb(op1: number, op2: number, rd: number, s: number) {
            this.sub(op2, op1, rd, s);
        }

        /**
         * Implements the 'Add' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private add(op1: number, op2: number, rd: number, s: number) {
            var r = op1.toUint32() + op2.toUint32();
            this.gpr[rd] = r.toUint32();
            if (s) {
                this.cpsr.C = r > 0xFFFFFFFF;
                this.cpsr.V = (~(op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Add with Carry' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private adc(op1: number, op2: number, rd: number, s: number) {
            var r = op1.toUint32() + op2.toUint32() + (this.cpsr.C ? 1 : 0);
            this.gpr[rd] = r.toUint32();
            if (s) {
                this.cpsr.C = r > 0xFFFFFFFF;
                this.cpsr.V = (~(op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Subtract with Carry' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private sbc(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (op1 - op2 - (this.cpsr.C ? 1 : 0)).toUint32();
            if (s) {
                this.cpsr.C = this.gpr[rd] <= op1; // FIXME: Is this correct?
                this.cpsr.V = ((op1 ^ op2) & (op1 ^ this.gpr[rd])).msb();
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Reverse Subtract with Carry' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private rsc(op1: number, op2: number, rd: number, s: number) {
            this.sbc(op2, op1, rd, s);
        }

        /**
         * Implements the 'Test' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         */
        private tst(op1: number, op2: number, rd: number) {
            var r = (op1 & op2).toUint32();
            this.cpsr.N = r.msb();
            this.cpsr.Z = r == 0;
        }

        /**
         * Implements the 'Test Equivalence' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         */
        private teq(op1: number, op2: number, rd: number) {
            var r = (op1 ^ op2).toUint32();
            this.cpsr.N = r.msb();
            this.cpsr.Z = r == 0;
        }

        /**
         * Implements the 'Compare' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         */
        private cmp(op1: number, op2: number, rd: number) {
            var r = (op1 - op2).toUint32();
            this.cpsr.C = r <= op1;
            this.cpsr.V = ((op1 ^ op2) & (op1 ^ r)).msb();
            this.cpsr.N = r.msb();
            this.cpsr.Z = r == 0;
        }

        /**
         * Implements the 'Compare Negative' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         */
        private cmn(op1: number, op2: number, rd: number) {
            var r = op1.toUint32() + op2.toUint32();
            this.cpsr.C = r > 0xFFFFFFFF;
            this.cpsr.V = (~(op1 ^ op2) & (op1 ^ r)).msb();
            this.cpsr.N = r.msb();
            this.cpsr.Z = r == 0;
        }

        /**
         * Implements the 'Logical OR' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private orr(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (op1 | op2).toUint32();
            if (s) {
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Move' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private mov(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = op2.toUint32();
            if (s) {
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Bit Clear' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private bic(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (op1 & (~op2).toUint32()).toUint32();
            if (s) {
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Move Negative' instruction.
         *
         * @param {number} op1
         *  The first operand of the operation.
         * @param {number} op2
         *  The second operand of the operation.
         * @param {number} rd
         *  The destination register.
         * @param {number} s
         *  Determines whether the instruction updates the CPSR.
         */
        private mvn(op1: number, op2: number, rd: number, s: number) {
            this.gpr[rd] = (~op2).toUint32();
            if (s) {
                this.cpsr.N = this.gpr[rd].msb();
                this.cpsr.Z = this.gpr[rd] == 0;
            }
        }

        /**
         * Implements the 'Load Register' and 'Store Register' instruction.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private ldr_str(iw: number): number {
            var i = (iw >> 25) & 0x1, p = (iw >> 24) & 0x1, u = (iw >> 23) & 0x1,
                b = (iw >> 22) & 0x1, w = (iw >> 21) & 0x1, l = (iw >> 20) & 0x1,
                rn = (iw >> 16) & 0xF,
                rd = (iw >> 12) & 0xF,
                cy = l ? ((rd == 15) ? 5 : 3) : 2,
                ofs = 0;
            if (i == 0) {
                // Offset is unsigned 12-bit immediate.
                ofs = iw & 0xFFF;
            } else {
                // Offset is shifted register.
                var rm = iw & 0xF;
                var sh = (iw >> 4) & 0xFF;
                var sOp = (sh >> 1) & 0x03;
                var amt = (sh >> 3) & 0x1F;
                switch (sOp) {
                    case 0: // LSL
                        ofs = this.gpr[rm] << amt;
                        break;
                    case 1: // LSR
                        ofs = this.gpr[rm] >>> ((amt != 0) ? amt : 32);
                        break;
                    case 2: // ASR
                        ofs = this.gpr[rm] >> ((amt != 0) ? amt : 32);
                        break;
                    case 3: // ROR
                        // Amt == 0: RRX
                        if (!amt)
                            ofs = ((this.cpsr.C ? 1 : 0) << 31) | (this.gpr[rm] >>> 1);
                        else
                            ofs = Util.RotateRight(this.gpr[rm], amt);
                        break;
                }
            }
            if (!u)
                ofs = (-1) * ofs;
            var addr = this.gpr[rn] + (p ? ofs : 0);
            try {
                if (l)
                    this.gpr[rd] = this.Read(addr, b ? DataType.Byte : DataType.Word);
                else
                    this.Write(addr, b ? DataType.Byte : DataType.Word, this.gpr[rd]);
            } catch (e) {
                if (e.Message == 'BadAddress') {
                    this.RaiseException(CpuException.Data);
                    return cy;
                }
                throw e;
            }
            if (p == 0)
                addr = addr + ofs;
            // Writeback (always true if post-indexed).
            if (w || p == 0)
                this.gpr[rn] = addr;
            return cy;
        }

        /**
         * Implements the 'Load Multiple' and 'Store Multiple' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private ldm_stm(iw: number): number {
            var p = (iw >> 24) & 0x1, u = (iw >> 23) & 0x1, s = (iw >> 22) & 0x1,
                w = (iw >> 21) & 0x1, l = (iw >> 20) & 0x1,
                rn = (iw >> 16) & 0xF,
                rlist = iw & 0xFFFF,
                cy = l ? ((rlist & 0x8000) ? 4 : 2) : 1,
                offset = u ? 0 : (-4 * Util.CountBits(rlist)),
                user = false, // Use banked user registers instead of current mode's.
                cpsr = false;
            if (s) {
                if (!this.spsr) // Unpredictable.
                    return cy;
                if (l && (rlist & 0x8000))
                    cpsr = true; // Replace CPSR with SPSR of current mode.
                else
                    user = true;
            }
            // Flip p bit if offset != 0 (see Figure 4-19 to 4-22, Section 4.11.2).
            if (offset)
                p = p ? 0 : 1;
            var addr = this.gpr[rn] + offset;
            for (var i = 0; i < 16; i++) {
                if (!(rlist & (1 << i)))
                    continue;
                cy = cy + 1;
                if (p)
                    addr = addr + 4;
                try {
                    // Load.
                    if (l) {
                        var c = this.Read(addr, DataType.Word);
                        if (user && i > 7 && i < 15)
                            this.banked[CpuMode.User][i] = c;
                        else
                            this.gpr[i] = c;
                    } else {
                        // Store.
                        if (user && i > 7 && i < 15) {
                            this.Write(addr, DataType.Word, this.banked[CpuMode.User][i]);
                        } else {
                            this.Write(addr, DataType.Word, this.gpr[i]);
                        }
                    }
                } catch (e) {
                    if (e.Message == 'BadAddress') {
                        this.RaiseException(CpuException.Data);
                        return cy;
                    }
                    throw e;
                }
                if (!p)
                    addr = addr + 4;
            }
            if (w)
                this.gpr[rn] = addr + offset;
            if (cpsr)
                this.LoadCpsr(this.spsr);
            return cy;
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

        /**
         * Implements the 'Multiply' and 'Multiply Accumulate' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private mul_mla(iw: number): number {
            var a  = (iw >> 21) & 0x1,
                s  = (iw >> 20) & 0x1,
                rd = (iw >> 16) & 0xF,
                rn = (iw >> 12) & 0xF,
                rs = (iw >> 8) & 0xF,
                rm = iw & 0xF,
                cy = (a ? 2 : 1) + this.GetMultiplyCycles(rs);
            this.gpr[rd] = (this.gpr[rm] * this.gpr[rs]).toUint32();
            if (a)
                this.gpr[rd] = (this.gpr[rd] + this.gpr[rn]).toUint32();
            if (s) {
                this.cpsr.N = (this.gpr[rd] >>> 31) == 1;
                this.cpsr.Z = this.gpr[rd] == 0;
            }
            return cy;
        }

        /**
         * Implements the 'Signed Multiply Long', 'Signed Multiply Accumulate Long', 'Unsigned
         * Multiply Long' and 'Unsigned Multiply Accumulate Long' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private mull_mlal(iw: number): number {
            var u = (iw >> 22) & 0x1,
                a = (iw >> 21) & 0x1,
                s = (iw >> 20) & 0x1,
                rdHi = (iw >> 16) & 0xF,
                rdLo = (iw >> 12) & 0xF,
                rs = (iw >> 8) & 0xF,
                rm = iw & 0xF,
                cy = (a ? 3 : 2) + this.GetMultiplyCycles(rs),
                ret = u ? Math.smul64(this.gpr[rs], this.gpr[rm]) :
                    Math.umul64(this.gpr[rs], this.gpr[rm]);
            if (a)
                ret = Math.add64(ret, { hi: this.gpr[rdHi], lo: this.gpr[rdLo] });
            this.gpr[rdHi] = ret.hi;
            this.gpr[rdLo] = ret.lo;
            if (s) {
                this.cpsr.N = (this.gpr[rdHi] >>> 31) == 1;
                this.cpsr.Z = this.gpr[rdHi] == 0 && this.gpr[rdLo] == 0;
            }
            return cy;
        }

        /**
         * Implements the 'Load Register Halfword', 'Store Register Halfword', 'Load Register
         * Signed Byte' and 'Load Register Signed Halfword' instructions.
         *
         * @param iw
         *  The instruction word.
         * @return {number}
         *  The number of clock cycles taken to execute the instruction.
         */
        private ldrh_strh_ldrsb_ldrsh(iw: number): number {
            var p = (iw >> 24) & 0x1,
                u = (iw >> 23) & 0x1,
                i = (iw >> 22) & 0x1,
                w = (iw >> 21) & 0x1,
                l = (iw >> 20) & 0x1,
                rn = (iw >> 16) & 0xF,
                rd = (iw >> 12) & 0xF,
                s = (iw >> 6) & 0x1,
                h = (iw >> 5) & 0x1,
                // Offset is either unsigned 8-bit immediate or content of register.
                ofs = i ? (((iw >> 4) & 0xF0) | (iw & 0xF)) : this.gpr[iw & 0x0F],
                cy = l ? ((rd == 15) ? 5 : 3) : 2;
            if (!u)
                ofs = (-1) * ofs;
            var addr = this.gpr[rn] + (p ? ofs : 0);
            try {
                if (l)
                    this.gpr[rd] = this.Read(addr, h ? DataType.Halfword : DataType.Byte);
                else
                    this.Write(addr, h ? DataType.Halfword : DataType.Byte, this.gpr[rd]);
            } catch (e) {
                if (e.Message == 'BadAddress') {
                    this.RaiseException(CpuException.Data);
                    return cy;
                }
                else {
                    throw e;
                }
            }
            // Sign extend.
            if (s && l)
                this.gpr[rd] = Util.SignExtend(this.gpr[rd], h ? 16 : 8, 32);
            if (p == 0)
                addr = addr + ofs;
            // Writeback (always true if post-indexed).
            if (w || p == 0)
                this.gpr[rn] = addr;
            return cy;

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
            this.RaiseException(CpuException.Undefined);
            return 3;
        }
    }
}