///<reference path="jasmine.d.ts"/>
///<reference path="../Assembler/Assembler.ts"/>

/**
 * Contains unit-tests for the ARMv4T Assembler.
 */
describe('Assembler Tests', () => {
    const Assembler = ARM.Assembler.Assembler;

    /**
     * Assembler listing containing some invalid assembler directive.
     */
    var listing_1 = [
        '.arm',
        '.section .data',
        'hello_sio:',
        '.asciz "Hello World from serial I/O!"',
        '.section .text',
        '@ UART0 Registers',
        '.equ    U0RBR,            0xE0000000 @ Receiver Buffer',
        '.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer',
        '.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte',
        '',
        '@ Some unrecognized directive',
        '.foobar 12 34'
    ].join('\n');

    var listing_2 = [
        '.arm',
        '.section .data',
        'hello_sio:',
        '.asciz "Hello World from serial I/O!"',
        '.section .text',
        '@ UART0 Registers',
        '.equ    U0RBR,            0xE0000000 @ Receiver Buffer',
        '.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer',
        '.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte',
        '.equ    U0DLH,            0xE0000004 @ Divisor Latch High Byte',
        '.equ    U0IER,            0xE0000004 @ Interrupt Enable Register',
        '.equ    U0IIR,            0xE0000008 @ Interrupt Identification Register',
        '.equ    U0FCR,            0xE0000008 @ FIFO Control Register',
        '.equ    U0LCR,            0xE000000C @ Line Control Register',
        '.equ    U0LSR,            0xE0000014 @ Line Status Register',
        '.equ    U0SCR,            0xE000001C @ Scratch Register',
        '',
        '.equ    LCR8N1,           0x03       @ 8 Bits, 1 Stop bit, no parity',
        '.equ    PCON,             0xE01FC000 @ Power Control Register',
        '',
        '.equ    RAM_SIZE,         0x00008000 @ 32kb',
        '.equ    RAM_BASE,         0x00400000',
        '.equ    TOPSTACK,         RAM_BASE + RAM_SIZE',
        '',
        '@R13 acts as stack pointer by convention',
        'ldr  r0,  =TOPSTACK',
        'mov  r13, r0',
        '',
        '@ prints a string to the terminal',
        'main:',
        '  bl sio_init',
        '  ldr r0, =hello_sio',
        '  bl sio_puts',
        '  @ busy wait until UART is done before exiting',
        '  ldr r0, =U0LSR',
        'still_busy:',
        '    ldrb r1, [r0], #0',
        '    ands r1, #64',
        '    beq still_busy',
        '  bl _exit',
        ''
    ].join('\n');

    /**
     * Ensures trying to assemble source code containing invalid directives raises an exception.
     */
    it('Invalid Assembler Directive', () => {
        expect(() => 
            Assembler.Assemble(listing_1, {
                '.TEXT': 0x40000,
                '.DATA': 0x80000
            })
        ).toThrow();
    });

    it('Assemble', () => {
        Assembler.Assemble(listing_2, {});
    });
});