@
@ Interrupt Handling
@
@ This listing demonstrates the configuration and usage of the programmable
@ interrupt controller (PIC). The PIC's outgoing interrupt signals are inverted
@ and fed into the CPU's nFIQ and nIRQ inputs, respectively.
@
@ This example program bootstraps the system, initializes the PIC and then
@ configures one of the hardware timers to periodically raise interrupts with
@ the PIC. The interrupt service routine then increments a counter value which
@ is output to the LCD display.
@
.arm
.section .text
@
@ ARM exception vectors are located at 0x00 - 0x1C
@
B ResetException
B UndefinedException
B SoftwareException
B PrefetchException
B DataException
NOP @ Reserved
B IRQException
B FIQException

ResetException:     B _start
UndefinedException: B UndefinedException
SoftwareException:  B SoftwareException
PrefetchException:  B PrefetchException
DataException:      B DataException
IRQException:       B _irq
FIQException:       B FIQException

@
@ Bootstraps the system, i.e. setup stack, initialize peripherals and enable
@ CPU interrupts.
@
_start:
  .equ  RAM_SIZE,         0x00008000    @ 32kb
  .equ  RAM_BASE,         0x00040000
  .equ  TOPSTACK,         RAM_BASE + RAM_SIZE
  @ Setup stack pointer
  ldr  r0,  =TOPSTACK
  mov  r13, r0
  @ Initialize LCD controller
  bl init_lcd
  @ Initialize PIC
  bl init_pic
  @ Enable FIQ and IRQ CPU interrupts
  mrs r1, CPSR
  bic r1, r1, #0xC0
  msr CPSR, r1
  @ Initialize Timer 0
  bl init_timer
  @ Timer is counting. Sit in a busy loop refreshing the LCD and wait for
  @ interrupts to happen.
  loop:
   bl refresh_lcd
   nop
   nop
   b loop

@
@ Initializes the Programmable Interrupt Controller.
@
init_pic:
  stmfd sp!, {r0-r1,lr}
  @ Setup interrupt source 2, which is connected to TIMER0 with a priority of
  @ 20 (highest).
  .equ  INTPRIO_5,        0xE0010020
  .equ  INTMASK,          0xE0010008
  ldr r0, =INTPRIO_5
  mov r1, #2
  str r1, [r0], #0
  @ Clear out mask register so all sources are serviced.
  ldr r0, =INTMASK
  mov r1, #0
  str r1, [r0], #0
  ldmfd sp!, {r0-r1,lr}
  bx lr

@
@ Initializes and enables Hardware Timer 0.
@
init_timer:
  stmfd sp!, {r0-r1,lr}
  .equ  TIMER0_MOD,       0xE0014000
  .equ  TIMER0_CNT,       0xE0014008
  ldr r0, =TIMER0_CNT
  ldr r1, =0x20
  str r1, [r0], #0
  ldr r0, =TIMER0_MOD
  @ Enable timer, Clock selection = CPU Clock, Zero-Return,
  @ Generate Compare Interrupt.
  ldr r1, =0x1C0
  str r1, [r0], #0
  ldmfd sp!, {r0-r1,lr}
  bx lr

@
@ Initializes the HITACHI HD44780U LCD Controller.
@
init_lcd:
  .equ  LCD_CMD_FUNCTION_SET,  0x38
  .equ  LCD_CMD_DISP_CONTROL,  0x0C
  .equ  LCD_CMD_ENTRY_MODE,    0x04
  stmfd sp!, {r0-r2,lr}
  @ Set to 8-bit operation and select 2-line display and 5x8 dot
  @ character font.
  ldr r0, =LCD_CMD_FUNCTION_SET
  bl lcd_command
  @ Turn on display. Entire display is in space mode because of
  @ initialization.
  ldr r0, =LCD_CMD_DISP_CONTROL 
  bl lcd_command
  @ Sets mode to increment the address by one and to shift the cursor
  @ to the left at the time of write to the DD/CGRAM. Display is not
  @ shifted.
  ldr r0, =LCD_CMD_ENTRY_MODE
  bl lcd_command
  ldmfd sp!, {r0-r2,lr}
  bx lr

@
@ Issues a command to the LCD controller.
@
lcd_command:
  .equ  LCDIOCTL,         0xE0008000 @ LCD I/O Control
  .equ  LCDDATA,          0xE0008004 @ LCD Data Bus
  stmfd sp!, {r1-r3,lr}
  ldr r1, =LCDIOCTL
  mov r2, #4 @ E high
  str r2, [r1], #0
  ldr r3, =LCDDATA
  str r0, [r3], #0
  mov r2, #0 @ E low
  str r2, [r1], #0
  @ delay for a couple of cycles
  ldmfd sp!, {r1-r3,lr}
  bx lr

@
@ Re-reads the counter value from memory that is updated by the interrupt
@ service routine (see below) and updates the LCD display with it.
@
refresh_lcd:
  @ LCD commands, refer to HITACHI HD44780 manual for details.
  @ Clear entire display and set DDRAM address 0 in address counter.
  .equ  LCD_CMD_DISP_CLEAR,    0x01
  stmfd sp!, {r0-r2,lr}
  @ Move cursor to the right edge of the first line.
  ldr r0, =LCD_CMD_ENTRY_MODE
  bl lcd_command
  mov r0, #0x8F
  bl lcd_command
  @ Reload counter value from memory into R0.
  ldr r1, =0x00040100
  ldr r0, [r1], #0
  mov r1, #10
  next_digit:
    bl div
    add r0, r0, #48
    bl lcd_write_char
    movs r0, r1
    mov r1, #10
    bgt next_digit
  nop
  nop
  ldmfd sp!, {r0-r2,lr}
  bx lr

@
@ Writes a single character to the current position of the LCD cursor.
@
lcd_write_char:
  stmfd sp!, {r1-r3,lr}
  ldr r1, =LCDIOCTL
  mov r2, #5 @ RS high, E high
  str r2, [r1], #0
  ldr r3, =LCDDATA
  strb r0, [r3], #0
  mov r2, #1 @ RS high, E low
  str r2, [r1], #0
  ldmfd sp!, {r1-r3,lr}
  bx lr

@
@ ARMv4 does not implement hardware division.
@
div:
  stmfd sp!, {r2,lr}
  mov r2, #0
  subtract_loop:
    subs r0, r0, r1
    addge r2, r2, #1
    bge subtract_loop
  addmi r0, r0, r1
  mov r1, r2
  ldmfd sp!, {r2,lr}
  bx lr

@
@ Processes IRQ requests. Note the CPU is in IRQ mode when this is entered.
@
_irq:
  .equ  INTPENDING,       0xE0010004
  .equ  TIMER0MODE,       0xE0014000
  @ Clear pending TIMER0 equal flag.
  ldr r11, =TIMER0MODE
  ldr r9, [r11], #0
  str r9, [r11], #0
  @ Acknowledge pending interrupt to drive nIRQ high.
  ldr r11, =INTPENDING
  mov r9, #4
  str r9, [r11], #0
  @ Load counter value from memory, increment and write back.
  ldr r11, =0x00040100 @ memory address where counter value is stored.
  ldr r9, [r11], #0
  add r9, r9, #1
  str r9, [r11], #0
  @ Copies saved address into program counter and copies SPSR into CPSR to
  @ switch the CPU back from IRQ to previous mode.
  subs pc, r14, #4

@ halts execution
_exit:
  .equ  PCON,            0xE01FC000    @ Power Control Register
  @ Power is turned off by setting bit 1.
  ldr r0, =PCON
  mov r1, #1
  strb r1, [r0]

.end