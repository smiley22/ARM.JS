#include "devboard.h"

void lcd_init();
void lcd_puts(char *s);
void lcd_putc(char c);
void lcd_seek(unsigned char pos);
void lcd_home();
void lcd_clear();
void lcd_command(unsigned char command);
void delay();
void print_intro_text();
void gpio_init();
int poll_buttons();
void set_leds(int mask);
void do_led_animation();

#define MAX_DISPLAY_CHARS 15

static char *text[] = {
  "Hello from compiled C program! Press",
  "and hold any of the number",
  "keys from 1-8 on your keyboard",
  "to enable the respective LED.",
  "Press 9 to exit the program.",
  0
};

int main() {
  /* configure input and output ports */
  gpio_init();
  print_intro_text();
  /* poll buttons in a loop until user exits */
  while (poll_buttons())
    ;
  lcd_clear();
  lcd_puts("Good Bye!");
  do_led_animation();
  return 0;
}

void print_intro_text() {
  char **p = text;
  int i;
  lcd_init();
  while (*p) {
    lcd_clear();
    lcd_seek(0x00);
    lcd_puts(*p);
    for (i = 0; i < 20; i++)
      delay();
    p++;
    if (!*p)
      break;
    lcd_home();
    lcd_seek(0x40);
    lcd_puts(*p);
    for (i = 0; i < 20; i++)
      delay();
    p++;
  }
}

int poll_buttons() {
  int buttons = IO1PIN;
  set_leds(buttons);
  /* return 0 to exit, otherwise keep going */
  return !(buttons & (1 << 9));
}

void set_leds(int mask) {
  IO0PIN = mask;
}

void gpio_init() {
  /* configure IO0PORT 0-9 which are connected to the LEDs as output */
  IO0DIR |= 0x3FF;
  /* don't need to configure IO1PORT 0-1 which are connected to push buttons
     as IO ports default to input.
  */
}

void lcd_init() {
  /* Set to 8-bit operation and select 2-line display and 5 × 8 dot character
     font (Number of display lines and character fonts cannot be changed after
     this). */
  lcd_command(0x38);
  /* Turn on display and cursor. Entire display is in space mode because of
     initialization. */
  lcd_command(0x0F);
  /* Set mode to increment the address by one and to shift the cursor to the
     right at the time of write to the DD/CGRAM. Display is not shifted. */
  lcd_command(0x06);
}

void lcd_puts(char *s) {
  int i = 0;
  // turn off display shift
  lcd_command(0x06);
  while(*s) {
    // turn on display shift
    if (i == MAX_DISPLAY_CHARS)
      lcd_command(0x07);
    lcd_putc(*s);
    delay();
    s++;
    i++;
  }
}

void lcd_putc(char c) {
  LCDIOCTL = 0x05;
  LCDDATA  = c;
  LCDIOCTL = 0x01;
}

void lcd_seek(unsigned char pos) {
  lcd_command(pos | (1 << 7));
}

void lcd_home() {
  lcd_command(0x02);
}

void lcd_clear() {
  lcd_command(0x01);
}

void lcd_command(unsigned char command) {
  LCDIOCTL = 0x04; /* set E high */
  LCDDATA  = command;
  LCDIOCTL = 0x00; /* set E low */
}

void delay() {
    int i;
    for(i = 0; i < 20; i++)
        ;
}

void do_led_animation() {
  unsigned char mask = 0xff;
  int i;
  while (mask) {
    set_leds(mask);
    for (i = 0; i < 3; i++)
      delay();
    mask = mask >> 1;
  }
  mask = 0x01;
  while (mask) {
    set_leds(mask);
    for (i = 0; i < 3; i++)
      delay();
    mask = (mask << 1);
  }
}