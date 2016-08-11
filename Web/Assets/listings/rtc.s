@
@ Querying the Real-Time Clock
@
@ This listing demonstrates how to query the devboard's DS1307 Real-Time Clock.
@
@ The program bootstraps the system, queries the RTC to determine the current
@ date and time as binary-coded decimals (BCD) and prints them as formatted
@ strings to the LCD display.
@
.arm
.section .data
days:
    .asciz "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"
    .asciz "Sunday"
months:
    .asciz "January", "February", "March", "April", "May", "June", "July"
    .asciz "August", "September", "October", "November", "December"
.section .text
@
@ ARM exception vectors are located at 0x00 - 0x1C
@
ResetException:     B _start
UndefinedException: B UndefinedException
SoftwareException:  B SoftwareException
PrefetchException:  B PrefetchException
DataException:      B DataException
NOP @ Reserved
IRQException:       B IRQException
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
  @ Initialize LCD controller.
  bl init_lcd
  @ Query RTC and convert from BCD to decimal values. Queried values are put
  @ into registers r2 - r8.
  loop:
  bl query_rtc
  @ Format and output on LCD
  bl lcd_write_date
  b _exit

@
@ Initializes the HITACHI HD44780U LCD Controller.
@
init_lcd:
  .equ  LCD_CMD_FUNCTION_SET,  0x38
  .equ  LCD_CMD_DISP_CONTROL,  0x0F
  .equ  LCD_CMD_ENTRY_MODE,    0x06
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
  @ to the right at the time of write to the DD/CGRAM. Display is not
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
  ldmfd sp!, {r1-r3,lr}
  bx lr

@
@ Re-reads the counter value from memory that is updated by the interrupt
@ service routine (see below) and updates the LCD display with it.
@
lcd_write_date:
  @ LCD commands, refer to HITACHI HD44780 manual for details.
  @ Clear entire display and set DDRAM address 0 in address counter.
  .equ  LCD_CMD_DISP_CLEAR,    0x01
  stmfd sp!, {r0-r1,lr}
  @ Reload counter value from memory into R0.
  mov r0, r6
  bl lcd_write_bcd_number
  mov r0, #46
  bl lcd_write_char
  mov r0, r7
  bl lcd_write_bcd_number
  mov r0, #46
  bl lcd_write_char
  mov r0, r8
  bl lcd_write_bcd_number
  @ Move cursor to second display line.
  bl lcd_switch_to_second_line
  mov r0, r4
  bl lcd_write_bcd_number
  mov r0, #58
  bl lcd_write_char
  mov r0, r3
  bl lcd_write_bcd_number
  mov r0, #58
  bl lcd_write_char
  mov r0, r2
  bl lcd_write_bcd_number
  ldmfd sp!, {r0-r1,lr}
  bx lr

@
@ Writes a single character to the current position of the LCD cursor.
@
lcd_write_bcd_number:
  stmfd sp!, {r1-r3,lr}
  and r1, r0, #0x0F
  lsr r2, r0, #4
  mov r0, r2
  add r0, r0, #48
  bl lcd_write_char
  mov r0, r1
  add r0, r0, #48
  bl lcd_write_char
  ldmfd sp!, {r1-r3,lr}
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
@ Moves the cursor in display RAM to the starting address of the second
@ display line at LCD memory address 0x40.
@
lcd_switch_to_second_line:
  stmfd sp!, {r0,lr}
  mov r0, #0x02
  bl lcd_command
  mov r0, #0xC0
  bl lcd_command
  mov r0, #0x06
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@
@ Clears the LCD display and resets the cursor to the top-left position.
@
lcd_clear:
  stmfd sp!, {r0,lr}
  ldr r0, =LCD_CMD_DISP_CLEAR
  bl lcd_command
  ldmfd sp!, {r0,lr}
  bx lr

@
@ Queries the real-time clock. For convenience this simply writes the results
@ into CPU registers r2 and upwards.
@
query_rtc:
  .equ RTCREGBASE,        0xE0020000 @ Start of RTC H/W Registers
  stmfd sp!, {r0-r1,lr}
  ldr r0, =RTCREGBASE
  @ All values are encoded as binary-coded decimals (BCD).
  ldrb r2, [r0], #1 @ Seconds
  ldrb r3, [r0], #1 @ Minutes
  ldrb r4, [r0], #1 @ Hours
  ldrb r5, [r0], #1 @ Day of week (1 - 7 with 1 being sunday)
  ldrb r6, [r0], #1 @ Day of month (date, 1 - 31)
  ldrb r7, [r0], #1 @ Month
  ldrb r8, [r0], #1 @ Year
  ldmfd sp!, {r0-r1,lr}
  bx lr

@
@ Delays execution for a couple of clock-cycles.
@
delay:
  stmfd sp!, {r0,lr}
  ldr r0, =#100
  delay_loop:
    subs r0, r0, #1
    beq delay_end
    b delay_loop
  delay_end:
    ldmfd sp!, {r0,lr}
    bx lr

@ halts execution
_exit:
  .equ  PCON,             0xE01FC000    @ Power Control Register
  @ Power is turned off by setting bit 1.
  ldr r0, =PCON
  mov r1, #1
  strb r1, [r0]

.end