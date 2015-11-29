// A simple DevBoard Virtual Machine with some simple
// HW devices mapped into memory and a simple 'video'-device
// to enable printing characters to the screen from within
// ARM programs.

var Board = new ARM.Simulator.DevBoard('myDevBoard-1');

$(function() {
  $(window).on('LED', function(e) {
    var leds = e.originalEvent.detail.params;
    for(var i = 0; i < leds.length; i++) {
      $('#led-' + i).toggleClass('led-on', leds[i] == 1);
    }
  });

  $(window).on('LCD-Display', function(e) {
    var params = e.originalEvent.detail.params;
    $('#lcd').toggleClass('lcd-on', params.TurnDisplayOn);
    $('.lcd-cursor').removeClass('lcd-cursor');
    $('.cursor-blink').removeClass('cursor-blink');
    if(params.ShowCursor)
      $('#lcd-cell-' + params.CursorPosition).addClass('lcd-cursor');
    if(params.CursorBlink)
      $('#lcd-cell-' + params.CursorPosition).addClass('cursor-blink');
  });

  $(window).on('LCD-Refresh', function(e) {
    var params = e.originalEvent.detail.params;
    for(var i = 0; i < params.Buffer.length; i++)
      $('#lcd-cell-' + i).text(params.Buffer[i] || '');
    if($('.lcd-cursor').length > 0) {
      $('.lcd-cursor').removeClass('lcd-cursor');
      $('#lcd-cell-' + params.CursorPosition).addClass('lcd-cursor');
    }
    if($('.cursor-blink').length > 0) {
      $('.cursor-blink').removeClass('cursor-blink');
      $('#lcd-cell-' + params.CursorPosition).addClass('cursor-blink');
    }
  });

  $(window).on('Reset', function(e) {
    $('.lcd-cursor').removeClass('lcd-cursor');
    $('.cursor-blink').removeClass('cursor-blink');
    $('#lcd').removeClass('lcd-on');
    $('[id^=led-]').removeClass('led-on');
    $('[id^=lcd-cell-]').text('');
  });
});