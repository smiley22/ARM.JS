.arm
.section .data
hello_sio:
    .asciz "Hello World from serial I/O!"
.section .text
@ UART0 Registers
.equ    U0RBR,            0xE0000000 @ Receiver Buffer
.equ    U0THR,            0xE0000000 @ Transmitter Holding Buffer
.equ    U0DLL,            0xE0000000 @ Divisor Latch Low Byte
.equ    U0DLH,            0xE0000004 @ Divisor Latch High Byte
.equ    U0IER,            0xE0000004 @ Interrupt Enable Register
.equ    U0IIR,            0xE0000008 @ Interrupt Identification Register
.equ    U0FCR,            0xE0000008 @ FIFO Control Register
.equ    U0LCR,            0xE000000C @ Line Control Register
.equ    U0LSR,            0xE0000014 @ Line Status Register
.equ    U0SCR,            0xE000001C @ Scratch Register

.equ    LCR8N1,           0x03       @ 8 Bits, 1 Stop bit, no parity
.equ    PCON,             0xE01FC000 @ Power Control Register

.equ    RAM_SIZE,         0x00008000 @ 32kb
.equ    RAM_BASE,         0x00040000
.equ    TOPSTACK,         RAM_BASE + RAM_SIZE

@ R13 acts as stack pointer by convention
ldr  r0,  =TOPSTACK
mov  r13, r0

@ prints a string to the 'terminal' window below
main:
  bl sio_init
  ldr r0, =hello_sio
  bl sio_puts
  @ busy wait until UART is done before exiting
  ldr r0, =U0LSR
still_busy:
    ldrb r1, [r0], #0
    ands r1, #64
    beq still_busy  
  bl _exit

@ initializes UART0
sio_init:
  stmfd sp!, {r0-r1,lr}
  ldr r0, =U0LCR
  @ enable DLAB to configure baudrate
  mov r1, #128
  strb r1, [r0], #0
  @ set baudrate to 115200 (DLH = 0x00, DLL = 0x01)
  ldr r0, =U0DLH
  mov r1, #0
  strb r1, [r0], #0
  ldr r0, =U0DLL
  mov r1, #1
  strb r1, [r0], #0
  @ clear DLAB and set mode to 8-N-1
  ldr r0, =U0LCR
  ldrb r1, =LCR8N1
  strb r1, [r0], #0
  @ disable all interrupts
  ldr r0, =U0IER
  mov r1, #0
  strb r1, [r0], #0
  @ enable and reset 64-byte FIFOs
  ldr r0, =U0FCR
  mov r1, #39
  strb r1, [r0], #0
  @ done!
  ldmfd sp!, {r0-r1,lr}
  bx lr

@ r0 -> character to transmit
sio_putc:
  stmfd sp!, {r1-r2,lr}
  ldr r1, =U0LSR
  fifo_full:
    ldrb r2, [r1], #0
    @ cleared bit 5 means TXFIFO is full
    ands r2, #32
  beq fifo_full
  ldr r1, =U0THR
  strb r0, [r1], #0
  ldmfd sp!, {r1-r2,lr}
  bx lr

@ r0 -> null-terminated string to transmit
sio_puts:
  stmfd sp!, {r0-r1,lr}
  mov r1, r0
char_loop:
  ldrb r0, [r1], #1
  cmp r0, #0
  beq char_loop_end
  bl sio_putc
  b char_loop
char_loop_end:
  ldmfd sp!, {r0-r1,lr}
  bx lr

@ halts execution
_exit:
  @ power is turned off by setting bit 1
  ldr r0, =PCON
  mov r1, #1
  strb r1, [r0]
.end