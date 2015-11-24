$(function() {
  var doc = CodeMirror($('#editor').get(0), {
     mode:  "z80",
     theme: 'hopscotch',
     value: $('#some-code').text()
  });

  $('#assemble').click(function() {
    var s = $('#status').empty();
    var c = doc.getValue();

    // Try to assemble instructions into binary image.
    try {
      var start = new Date().getTime();
      var img = ARMv4T.Assembler.Parse(c);
      var took = new Date().getTime() - start;
      s.append('<span class="success">0 error(s)</span>')
       .append('<br />')
       .append('Assembling instructions took ' + took + 'ms');
      $('#run').removeAttr('disabled');
    } catch(e) {
      var msg = e.toString ();
      // Extract line-number from stack-trace.
      // FIXME: Only tested in Google Chrome, does this work in other browsers too?
      var a = e.stack.split("\n");
      if(a[1].match(/^.*\/(.*):(.*):.*$/))
        msg = 'Exception in ' + RegExp.$1 + ' at line ' + RegExp.$2 + ': ' +
              '<span class="error-message">' + e.message + '</span>';
      emitError(msg);
      $('#run').attr('disabled', 'disabled');
    }
  });

  function emitError(e) {
    console.error(e);
    $('#status').append(e).append('<br />');
  }

});