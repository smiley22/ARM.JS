///<reference path="jasmine.d.ts"/>
///<reference path="MockService.ts"/>
///<reference path="../Simulator/Cpu.ts"/>

/**
 * Contains unit-tests for the ARM7-like CPU.
 */
describe('CPU Tests', () => {
    var cpu: ARM.Simulator.Cpu;
    var read: (address: number, type: ARM.Simulator.DataType) => number = null;
    var write: (address: number, type: ARM.Simulator.DataType, value: number) => void = null;
    var clockRate = 6.9824; // Mhz
    // So we can access private properties and methods for testing opcode decoding and cpu
    // instructions without having to make all of this stuff 'public'. In this case it just
    // seems to make sense to also test the internals of the class.
    var _cpu: any;

    /**
     * Exception vector branch instructions located at 0x00000000. Generated with arm-none-eabi-as.
     */
    var initCode = [
       0xea00000c,    // b 38 <ResetException>
       0xea000005,    // b 20 <UndefinedException>
       0xea000005,    // b 24 <SoftwareException>
       0xea000005,    // b 28 <PrefetchException>
       0xea000005,    // b 2c <DataException>
       0xe1a00000,    // nop ; (mov r0, r0)
       0xea000004,    // b 30 <IRQException>
       0xea000004,    // b 34 <FIQException>

       0xeafffffe,    // b 20 <UndefinedException>
       0xeafffffe,    // b 24 <SoftwareException>
       0xeafffffe,    // b 28 <PrefetchException>
       0xeafffffe,    // b 2c <DataException>
       0xeafffffe,    // b 30 <IRQException>
       0xeafffffe     // b 34 <FIQException>

      // 0x38 <ResetException>:
    ];
    var resetLabel = 0x38;

    /**
     * Sets up the text fixture. Runs before the first test is executed.
     */
    beforeAll(() => {
        // Hooks JS' setTimeout and setInterval functions, so we can test timing-dependent code.
        jasmine.clock().install();
    });

    /**
     * Tear down the test fixture. Runs after all test methods have been run.
     */
    afterAll(() => {
        jasmine.clock().uninstall();
    });

    /**
     * Runs before each test method is executed.
     */
    beforeEach(() => {
        cpu = new ARM.Simulator.Cpu(clockRate, (a, t) => {
            if (read != null)
                return read(a, t);
            throw new Error('Could not read data at ' + a);
        }, (a, t, v) => {
            if (write != null)
                write(a, t, v);
            else
                throw new Error('Could not write data at ' + a);
        });
        _cpu = cpu;
    });

    /**
     * Runs after each test method.
     */
    afterEach(() => {
        read = null;
        write = null;
    });

    /**
     * Ensures cpu registers contain default values after reset.
     */
    it('Reset Values', () => {
        // CPU Manual:
        //
        // Registers R0 - R14 (including banked registers) and SPSR (in all modes) are undefined
        // after reset. The Program Counter (PC/R15) will be set to 0x00000000. The Current
        // Program Status Register (CPSR) will indicate that the ARM core has started in ARM 
        // state, Supervisor mode with both FIQ and IRQ mask bits set. The condition code flags
        // will be undefined.
        expect(_cpu.pc).toBe(0);
        expect(_cpu.state).toBe(ARM.Simulator.CpuState.ARM);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
    });

    /**
     * Ensures the CPU properly decodes opcodes.
     */
    it('Opcode Decoding', () => {
        // ARM instructions generated with arm-none-eabi-as.
        var pairs = [
            [0xe0904002, _cpu.data],    // adds r4, r0, r2
            [0xe0a15003, _cpu.data],    // adc  r5, r1, r3
            [0xe280001a, _cpu.data],    // add  r0, r0, #26
            [0xe1510000, _cpu.data],    // cmp  r1, r0
            [0xeb000001, _cpu.b_bl],    // bl   14
            [0xe12fff1e, _cpu.bx],      // bx   lr
            [0xe3c99003, _cpu.data],    // bic  r9, r9, #3
            [0xee070f9a, _cpu.mrc_mcr], // mcr  15, 0, r0, cr7, cr10, {4}
            [0xe59f2038, _cpu.ldr_str], // ldr  r2, [pc, #56]
            [0xe129f000, _cpu.msr],     // msr  CPSR_fc, r0
            [0xee080f17, _cpu.mrc_mcr], // mcr  15, 0, r0, cr8, cr7, {0}
            [0xe59f2038, _cpu.ldr_str], // ldr  r2, [pc, #56]
            [0xe3c33001, _cpu.data],    // bic  r3, r3, #1
            [0xee013f10, _cpu.mrc_mcr], // mcr  15, 0, r3, cr1, cr0, {0}
            [0xe1a0f002, _cpu.data],    // mov  pc, r2
            [0xe59fc02c, _cpu.ldr_str], // ldr  ip, [pc, #44]
            [0xe3a000f3, _cpu.data],    // mov  r0, #243
            [0xe58c001f, _cpu.ldr_str], // str  r0, [ip, #31]
            [0xebfffffe, _cpu.b_bl],    // bl   0 <main>
            [0xeafffffe, _cpu.b_bl],    // b    58 <.text + 0x58>
            [0xe5901000, _cpu.ldr_str], // ldr  r1, [r0]
            [0xe3510000, _cpu.data],    // cmp  r1, #0
            [0x1a000000, _cpu.b_bl],    // bne  6c <.text + 0x6c>
            [0xe5801000, _cpu.ldr_str], // str  r1, [r0]
            [0xe5901008, _cpu.ldr_str], // ldr  r1, [r0, #8]
            [0xe590200c, _cpu.ldr_str], // ldr  r2, [r0, #12]
            [0xe4d13001, _cpu.ldr_str], // ldrb r3, [r1], #1
            [0x00000058, _cpu.data],    // andeq r0, r0, r8, asr r0
            [0x00001341, _cpu.data],    // andeq r1, r0, r1, asr #6
            [0x61750100, _cpu.data],    // cmnvs r5, r0, lsl #2
            [0x01100962, _cpu.data],    // tsteq r0, r2, ror #18
            [0x00000009, _cpu.data],    // andeq r0, r0, r9
            [0x01180306, _cpu.data]     // tsteq r8, r6, lsl #6
        ];
        for (var p of pairs)
            expect(_cpu.Decode(p[0])).toBe(p[1]);
    });

    /**
     * Ensures the processor starts fetching instructions from the reset vector after
     * power up.
     */
    it('Reset Instruction Fetch', () => {
        read = (a) => {
            expect(a).toBe(0x00000000);
            return 0;
        };
        cpu.Step();
    });

    /**
     * Ensures the processor takes the undefined instruction trap when encountering an
     * invalid/undefined instruction.
     */
    it('Undefined Instruction', () => {
        var rom = initCode.concat([
            0xFF000000 // Undefined instruction.
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step(); // Execute undefined instruction.
        // Next read should fetch instruction from the undefined instruction interrupt
        // vector (0x00000004).
        expect(_cpu.pc).toBe(0x00000004);
        // CPU mode should be 'undefined'.
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Undefined);
    });

    /**
     * Ensures the processor takes the software interrupt trap when encountering
     * a swi instruction.
     */
    it('Software Interrupt', () => {
        var rom = initCode.concat([
            0xef00000f // swi 15
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        // Next read should fetch instruction from the software interrupt exception
        // vector (0x00000008).
        expect(_cpu.pc).toBe(0x00000008);
        // CPU mode should be 'supervisor'.
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        // R14_svc - 4 should be address of the SWI instruction.
        var address = _cpu.gpr[14] - 4;
        expect(rom[address / 4]).toBe(0xef00000f);
    });

    /**
     * Ensures the processor takes the data abort trap when the data at an address is
     * unavailable.
     */
    it('Data Abort', () => {
        var abortInst = 0xe5901000;
        var rom = initCode.concat([
            0xe51f0000,   // ldr r0, [pc, #-0]
            abortInst,    // ldr r1, [r0]
            0x12345678    // embedded constant for ldr r0 instruction
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            if (a >= rom.length * 4)
                throw new Error('BadAddress');
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        cpu.Step();
        // R0 should contain 0x12345678 now.
        expect(_cpu.gpr[0]).toBe(0x12345678);
        // Trying to read from memory address 0x12345678 should raise a data-abort
        // exception.
        cpu.Step();
        var dataAbortVector = 0x00000010;
        expect(_cpu.pc).toBe(dataAbortVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Abort);
        // Instruction that caused the abort should be at R14_abt - 8.
        var address = _cpu.gpr[14] - 8;
        expect(rom[address / 4]).toBe(abortInst);
    });

    /**
     * Ensures FIQ exceptions are raised when taking the nFIQ input HIGH.
     */
    it('Fast Interrupt Request', () => {
        var rom = initCode.concat([
          0xe10f1000,  // mrs r1, CPSR
          0xe3c11040,  // bic r1, r1, #64
          0xe121f001,  // msr CPSR_c, r1

          // Some random instructions
          0xe0a15003,   // adc  r5, r1, r3
          0xe280001a,   // add  r0, r0, #26
          0xe1510000    // cmp  r1, r0
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        // CPU mode should be 'supervisor' and FIQ interrupts disabled.
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.F).toBe(true);
        for (let i = 0; i < 3; i++)
            cpu.Step();
        // FIQ interrupts should now be enabled.
        expect(_cpu.cpsr.F).toBe(false);
        // Execute some instruction and then take nFIQ input LOW.
        cpu.Step();
        cpu.nFIQ = false;
        // Next step should result in FIQ trap being taken.
        var fiqVector = 0x0000001C;
        cpu.Step();
        expect(_cpu.pc).toBe(fiqVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.FIQ);
        // FIQ exception should have disabled FIQ interrupts.
        expect(_cpu.cpsr.F).toBe(true);
        // IRQs should also be disabled.
        expect(_cpu.cpsr.I).toBe(true);
    });

    /**
     * Ensures IRQ exceptions are raised when taking the nIRQ input HIGH.
     */
    it('Interrupt Request', () => {
        var rom = initCode.concat([
            0xe10f1000,  // mrs r1, CPSR
            0xe3c110c0,  // bic r1, r1, #0xC0
            0xe121f001,  // msr CPSR_c, r1

            // Some random instructions
            0xe0a15003,   // adc  r5, r1, r3
            0xe280001a,   // add  r0, r0, #26
            0xe1510000    // cmp  r1, r0
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        // CPU mode should be 'supervisor' and IRQ + FIQ interrupts disabled.
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(true);
        for (let i = 0; i < 3; i++)
            cpu.Step();
        // IRQ + FIQ interrupts should now be enabled.
        expect(_cpu.cpsr.I).toBe(false);
        expect(_cpu.cpsr.F).toBe(false);
        // Execute some instruction and then take nIRQ input LOW.
        cpu.Step();
        cpu.nIRQ = false;
        // Next step should result in IRQ trap being taken.
        var irqVector = 0x00000018;
        cpu.Step();
        expect(_cpu.pc).toBe(irqVector);
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.IRQ);
        // IRQ exception should have disabled IRQ interrupts but FIQ interrupts
        // should still be enabled.
        expect(_cpu.cpsr.I).toBe(true);
        expect(_cpu.cpsr.F).toBe(false);
    });

    /**
     * Ensures switching processor modes works as expected.
     */
    it('Mode Switch', () => {
        var rom = initCode.concat([
            // Switch to System mode
            0xe10f3000,   // mrs r3, CPSR
            0xe383301f,   // orr r3, r3, #31
            0xe129f003,   // msr CPSR_fc, r3

            // Switch to User mode
            0xe10f3000,   // mrs r3, CPSR
            0xe3c3301f,   // bic r3, r3, #31
            0xe3833010,   // orr r3, r3, #16
            0xe129f003,   // msr CPSR_fc, r3

            // Switch to Supervisor mode
            0xe10f3000,   // mrs r3, CPSR
            0xe3c3301f,   // bic r3, r3, #31
            0xe3833013,   // orr r3, r3, #19
            0xe129f003    // msr CPSR_fc, r3
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        // Cpu starts up in 'supervisor' mode.
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        for (let i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.System);
        for (let i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
        // Trying to switch from user mode to a privileged mode must not work, of course.
        for (let i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
    });

    /**
     * Ensures banked registers are switched in when a processor mode switch occurs.
     */
    it('Register Banking', () => {
        // Stack pointer is banked.
        var sp_svc = 0x87654321;
        var sp_usr = 0x11112222;
        var rom = initCode.concat([
            0xe59fd01c,   // ldr sp, [pc, #28]	; 5c <ResetException + 0x24>
            // Switch to System mode
            0xe10f3000,   // mrs r3, CPSR
            0xe383301f,   // orr r3, r3, #31
            0xe129f003,   // msr CPSR_fc, r3
            0xe59fd010,   // ldr sp, [pc, #16]	; 60 <ResetException + 0x28>
            // Switch to User mode
            0xe10f3000,   // mrs r3, CPSR
            0xe3c3301f,   // bic r3, r3, #31
            0xe3833010,   // orr r3, r3, #16
            0xe129f003,   // msr CPSR_fc, r3
            0x87654321, 
            0x11112222
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        // Cpu starts in 'supervisor' mode.
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.Supervisor);
        cpu.Step();
        expect(_cpu.gpr[13]).toBe(sp_svc);
        for (let i = 0; i < 3; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.System);
        expect(_cpu.gpr[13]).not.toBe(sp_svc);
        cpu.Step();
        expect(_cpu.gpr[13]).toBe(sp_usr);
        for (let i = 0; i < 4; i++)
            cpu.Step();
        expect(_cpu.mode).toBe(ARM.Simulator.CpuMode.User);
        // User and System modes share register bank, so stack-pointer should still
        // have the same value as before.
        expect(_cpu.gpr[13]).toBe(sp_usr);
    });

    /**
     * Performs an addition that results in an integer overflow and ensures the condition
     * flags are updated with the expected values.
     */
    it('Addition Overflow', () => {
        var rom = initCode.concat([
            0xe3e01000,   // mvn  r1, #0
            0xe3a02001,   // mov  r2, #1
            0xe0910002    // adds r0, r1, r2
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        cpu.Step(); // Reset branch.
        expect(_cpu.pc).toBe(resetLabel);
        for (let i = 0; i < 3; i++)
            cpu.Step();
        // Expected flags:
        // N = 0 ; The result is 0, which is considered positive, and so the N (negative)
        //         bit is set to 0.
        expect(_cpu.cpsr.N).toBe(false);
        // Z = 1 ; The result is 0, so the Z (zero) bit is set to 1.
        expect(_cpu.cpsr.Z).toBe(true);
        // C = 1 ; We lost some data because the result did not fit into 32 bits, so the
        //         processor indicates this by setting C (carry) to 1.
        expect(_cpu.cpsr.C).toBe(true);
        // V = 0 ; From a two's complement signed-arithmetic viewpoint, 0xffffffff really
        //         means - 1, so the operation we did was really (-1) + 1 = 0. That operation
        //         clearly does not overflow, so V (overflow) is set to 0.
        expect(_cpu.cpsr.V).toBe(false);
    });

    /**
     * Performs some arithmetic calculations and ensures the results match the pre-calculated
     * expected results.
     */
    it('Integer Arithmetic #1', () => {
        // Hailstone sequence, taken from http://www.toves.org/books/arm/
        var rom = initCode.concat([
            // r0 = input number, r1 = number of iterations
            0xe3a00007,   // mov  r0, #3
            0xe3a01000,   // mov  r1, #0
            // 00000040 <again>:
            0xe2811001,   // add  r1, r1, #1
            0xe2104001,   // ands r4, r0, #1
            0x0a000002,   // beq 58 <even>
            0xe0800080,   // add r0, r0, r0, lsl #1
            0xe2800001,   // add r0, r0, #1
            0xeafffff9,   // b 40 <again>
            // 00000058 <even>:
            0xe1a000c0,   // asr  r0, r0, #1
            0xe2507001,   // subs r7, r0, #1
            0x1afffff6,   // bne 40 <again>
            // 00000064 <halt>:
            0xe51fa000,   // ldr sl, [pc, #-0]	; 6c <halt + 0x8>
            0xe58a0000,   // str r0, [sl]
            0x12345678    // eorsne r5, r4, #120, 12; 0x7800000
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = (a) => {
            // We use a store instruction to signal that the algorithm has finished.
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        // n=7; 22, 11, 34, 17, 52, 26, 13, 40, 20, 10, 5, 16, 8, 4, 2, 1.
        //      -> 16 iterations.
        var expectedIterations = 16;
        expect(_cpu.gpr[1]).toBe(expectedIterations);
    });

    /**
     * Performs some arithmetic calculations and ensures the results match the pre-calculated
     * expected results.
     */
    it('Integer Arithmetic #2', () => {
        // Adding digits, i.e. input = 1024, output = 7 (1 + 2 + 4)
        // Taken from http://www.toves.org/books/arm/
        var rom = initCode.concat([
            // r0 = input number (305419896), r1 = sum of digits
            0xe59f0034,   // ldr r0, [pc, #52]	; 74 <halt + 0x8>
            0xe3a01000,   // mov r1, #0
            0xe3a02419,   // mov r2, #419430400; 0x19000000
            0xe3822899,   // orr r2, r2, #10027008; 0x990000
            0xe3822c99,   // orr r2, r2, #39168; 0x9900
            0xe382209a,   // orr r2, r2, #154; 0x9a
            0xe3a0300a,   // mov r3, #10
            // 00000054 <loop>:
            0xe0854290,   // umull r4, r5, r0, r2
            0xe0864395,   // umull r4, r6, r5, r3
            0xe0404004,   // sub r4, r0, r4
            0xe0811004,   // add r1, r1, r4
            0xe1b00005,   // movs r0, r5
            0x1afffff9,   // bne 54 <loop>
            // 0000006c <halt>:
            0xe51fa000,   // ldr sl, [pc, #-0]	; 74 <halt + 0x8>
            0xe58a0000,   // str r0, [sl]
            0x12345678    // eorsne	r5, r4, #120, 12; 0x7800000
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = (a) => {
            // We use a store instruction to signal that the algorithm has finished.
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        // Input number: 305419896, expected result: 45 (3+0+5+4+1+9+8+9+6)
        var expectedResult = 45;
        expect(_cpu.gpr[1]).toBe(expectedResult);
    });

    /**
     * Ensures subroutine calls work as expected.
     */
    it('Branch and Link', () => {
        var rom = initCode.concat([
           0xe3a0000a,  // mov r0, #10
           0xe3a01003,  // mov r1, #3
           0xeb000002,  // bl 50 <doadd>
           // 00000044 <stop>:
           0xe3a02018,  // mov r2, #24
           0xe59f3008,  // ldr r3, [pc, #8]	; 58 <doadd + 0x8>
           0xe5830000,  // str r0, [r3]
           // 00000050 <doadd>:
           0xe0800001,  // add r0, r0, r1
           0xe12fff1e,  // bx lr
           0x12345678
        ]);
        read = (a) => {
            expect(a % 4).toBe(0);
            return rom[a / 4];
        };
        var stopRunning = false;
        write = (a) => {
            // We use a store instruction to signal that the algorithm has finished.
            expect(a).toBe(0x12345678);
            stopRunning = true;
        };
        while (!stopRunning)
            cpu.Step();
        // Input r0 = 10, r1 = 3, expected result: r0 + r1
        var expectedResult = 13;
        expect(_cpu.gpr[0]).toBe(expectedResult);
        // r2 should contain 24.
        expect(_cpu.gpr[2]).toBe(24);
    });
});