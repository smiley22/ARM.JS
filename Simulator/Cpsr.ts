module ARM.Simulator {
    /**
     * Represents the program status register of the ARM7 processor.
     */
    export class Cpsr {
        /**
         * The 'Negative or less than' condition code flag.
         */
        N: boolean;

        /**
         * The 'Zero' condition code flag.
         */
        Z: boolean;

        /**
         * The 'Carry or borrow extend' condition code flag.
         */
        C: boolean;

        /**
         * The 'Overflow' condition code flag.
         */
        V: boolean;

        /**
         * The 'IRQ disable' control bit. When set, IRQ interrupts are disabled.
         */
        I: boolean;

        /**
         * The 'FIQ disable' control bit. When set, FIQ interrupts are disabled.
         */
        F: boolean;

        /**
         * The 'CPU State' control bit. When set, the processor is executing in Thumb
         * state. When clear, the processor is executing in ARM state.
         */
        T: boolean;

        /**
         * Determines the processor operating mode.
         */
        Mode: CpuMode;

        /**
         * Initializes a new instance of the Cpsr class with the default values found in
         * the processor's CPSR register on reset.
         */
        constructor() {
            // On reset, the mode bits of the CPSR are forced to supervisor mode.
            this.Mode = CpuMode.Supervisor;
            // ...and IRQ and FIQ interrupts are disabled.
            this.I = this.F = true;
        }

        /**
         * Returns a 32-bit word representing this instance of the Cpsr class.
         *
         * @return {number}
         *  A 32-bit word representing this instance of the Cpsr class, encoded in the program
         *  status register format of the ARM7 processor.
         */
        ToWord(): number {
            var _n = this.N ? 1 : 0,
                _z = this.Z ? 1 : 0,
                _c = this.C ? 1 : 0,
                _v = this.V ? 1 : 0,
                _i = this.I ? 1 : 0,
                _f = this.F ? 1 : 0,
                _t = this.T ? 1 : 0;
            return ((_n << 31) | (_z << 30) | (_c << 29) | (_v << 28) |
                (_i << 7) | (_f << 6) | (_t << 5) | this.Mode).toUint32();
        }

        /**
         * Constructs an instance of the Cpsr class from the specified 32-bit word.
         *
         * @param {number} word
         *  The 32-bit word to construct the instance of the Cpsr class from. The value must be
         *  encoded in the program status register format of the ARM7 processor.
         * @return {number}
         *  An initialized instance of the Cpsr class, constructed from the specified 32-bit
         *  word.
         */
        static FromWord(word: number): Cpsr {
            var r = new Cpsr();
            r.N = ((word >> 31) & 0x01) ? true : false;
            r.Z = ((word >> 30) & 0x01) ? true : false;
            r.C = ((word >> 29) & 0x01) ? true : false;
            r.V = ((word >> 28) & 0x01) ? true : false;
            r.I = ((word >> 7) & 0x01) ? true : false;
            r.F = ((word >> 6) & 0x01) ? true : false;
            r.T = ((word >> 5) & 0x01) ? true : false;
            // FIXME: Ensure bit-pattern maps to a valid mode?
            r.Mode = word & 0x1F;
            return r;
        }

        /**
         * Constructs an instance of the Cpsr class from the program status register instance.
         *
         * @param {number} psr
         *  The Cpsr instance to initialize this instance with.
         * @return {number}
         *  An initialized instance of the Cpsr class, constructed from the specified Cpsr
         *  instance.
         */
        static FromPsr(psr: Cpsr): Cpsr {
            var r = new Cpsr();
            r.N = psr.N;
            r.Z = psr.Z;
            r.C = psr.C;
            r.V = psr.V;
            r.I = psr.I;
            r.F = psr.F;
            r.T = psr.T;
            r.Mode = psr.Mode;
            return r;
        }
    }
}