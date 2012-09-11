.arm
.section .text
.global _printf
.func   _printf

.equ    CON_BASE,		0x60000000
.equ    CON_CTL,		0x60000001

############################################
#											
# _printf
#																			
# IN
#	 r0 - address of null-terminated string
#
############################################
_printf:
		stmfd sp!, {r1-r3}
		ldr r2, =CON_BASE
		while:
			ldrb r1, [r0], #1
			cmp r1, #0
			beq	end_while
			strb r1, [r2]
			b	while
		end_while:
		ldr r2, =CON_CTL
		mov r3, #1
		strb r3, [r2]
		ldmfd sp!, {r1-r3}
		bx lr	

.end
