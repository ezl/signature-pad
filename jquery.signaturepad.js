/**
 * Usage for accepting signatures:
 *  $('.sigPad').signaturePad()
 *
 * Usage for displaying previous signatures:
 *  $('.sigPad').signaturePad({displayOnly:true}).regenerate(sig)
 *  or
 *  var api = $('.sigPad').signaturePad({displayOnly:true})
 *  api.regenerate(sig)
 */
(function ($) {

function SignaturePad (selector, options) {
  /**
   * Reference to the object for use in public methods
   *
   * @private
   *
   * @type {Object}
   */
  var self = this

  /**
   * Holds the merged default settings and user passed settings
   *
   * @private
   *
   * @type {Object}
   */
  , settings = $.extend({}, $.fn.signaturePad.defaults, options)

  /**
   * The current context, as passed by jQuery, of selected items
   *
   * @private
   *
   * @type {Object}
   */
  , context = $(selector)

  /**
   * jQuery reference to the canvas element inside the signature pad
   *
   * @private
   *
   * @type {Object}
   */
  , canvas = $(settings.canvas, context)

  /**
   * Dom reference to the canvas element inside the signature pad
   *
   * @private
   *
   * @type {Object}
   */
  , element = canvas.get(0)

  /**
   * The drawing context for the signature canvas
   *
   * @private
   *
   * @type {Object}
   */
  , canvasContext = null

  /**
   * Holds the previous point of drawing
   * Disallows drawing over the same location to make lines more delicate
   *
   * @private
   *
   * @type {Object}
   */
  , previous = {'x': null, 'y': null}

  /**
   * An array holding all the points and lines to generate the signature
   * Each item is an object like:
   * {
   *   mx: moveTo x coordinate
   *   my: moveTo y coordinate
   *   lx: lineTo x coordinate
   *   lx: lineTo y coordinate
   * }
   *
   * @private
   *
   * @type {Array}
   */
  , output = []

  /**
   * Stores a timeout for when the mouse leaves the canvas
   * If the mouse has left the canvas for a specific amount of time
   * Stops drawing on the canvas
   *
   * @private
   *
   * @type {Object}
   */
  , mouseLeaveTimeout = false

    /**
     * Whether the mouse button is currently pressed down or not
     *
     * @private
     *
     * @type {Boolean}
     */
  , mouseButtonDown = false

  /**
   * Whether the browser is a touch event browser or not
   *
   * @private
   *
   * @type {Boolean}
   */
  , touchable = false

  /**
   * Whether events have already been bound to the canvas or not
   *
   * @private
   *
   * @type {Boolean}
   */
  , eventsBound = false

  /**
   * Remembers the default font-size when typing, and will allow it to be scaled for bigger/smaller names
   *
   * @private
   *
   * @type {Number}
   */
  , typeItDefaultFontSize = 30

  /**
   * Remembers the current font-size when typing
   *
   * @private
   *
   * @type {Number}
   */
  , typeItCurrentFontSize = typeItDefaultFontSize

  /**
   * Remembers how many characters are in the name field, to help with the scaling feature
   *
   * @private
   *
   * @type {Number}
   */
  , typeItNumChars = 0


  , strokePoints = []

  /**
   * Clears the mouseLeaveTimeout
   * Resets some other variables that may be active
   *
   * @private
   */
  function clearMouseLeaveTimeout () {
    clearTimeout(mouseLeaveTimeout)
    mouseLeaveTimeout = false
    mouseButtonDown = false
  }

  /**
   * Draws a line on canvas using the mouse position
   * Checks previous position to not draw over top of previous drawing
   *  (makes the line really thick and poorly anti-aliased)
   *
   * @private
   *
   * @param {Object} e The event object
   * @param {Number} newYOffset A pixel value for drawing the newY, used for drawing a single dot on click
   */
  function drawLine (e, newYOffset) {
    var offset, newX, newY

    e.preventDefault()

    offset = $(e.target).offset()

    clearTimeout(mouseLeaveTimeout)
    mouseLeaveTimeout = false

    if (typeof e.changedTouches !== 'undefined') {
      newX = Math.floor(e.changedTouches[0].pageX - offset.left)
      newY = Math.floor(e.changedTouches[0].pageY - offset.top)
    } else {
      newX = Math.floor(e.pageX - offset.left)
      newY = Math.floor(e.pageY - offset.top)
    }

    if (previous.x === newX && previous.y === newY)
      return true

    if (previous.x === null)
      previous.x = newX

    if (previous.y === null)
      previous.y = newY

    if (newYOffset)
      newY += newYOffset

    // We always draw the linear bits
    canvasContext.beginPath()
    canvasContext.moveTo(previous.x, previous.y)
    canvasContext.lineTo(newX, newY)
    canvasContext.lineCap = settings.penCap
    canvasContext.stroke()
    canvasContext.closePath()


    // But if we want beziers, we erase the straight lines
    // As soon as we have enough points to draw a bezier over it
    if (settings.drawBezierCurves === true) {
      strokePoints.push({'lx': newX, 'ly': newY,
                         'mx': previous.x, 'my': previous.y});

      // 4 points to define a bezier * the number of points we need for skipping
      var maxCacheLength = 4 * settings.bezierSkip;

      if (strokePoints.length >= maxCacheLength) {
        // "Erase" the linear part that we drew and replace it with the bezier
        var retrace = output.slice(output.length - maxCacheLength + 2, output.length);

        canvasContext.strokeStyle = settings.bgColour;
        for (var i = 0; i < retrace.length; i++) {
          var point = retrace[i];
          canvasContext.beginPath()
          canvasContext.moveTo(point.mx, point.my)
          canvasContext.lineTo(point.lx, point.ly)
          canvasContext.lineCap = settings.penCap
          canvasContext.stroke()
          canvasContext.closePath()
        }
        canvasContext.strokeStyle = settings.penColour
        strokePath(strokePoints, canvasContext);
        strokePoints = strokePoints.slice(maxCacheLength - 1, maxCacheLength);
      }
    }

    output.push({
      'lx' : newX
      , 'ly' : newY
      , 'mx' : previous.x
      , 'my' : previous.y
    })

    previous.x = newX
    previous.y = newY

    if (settings.onDraw && typeof settings.onDraw === 'function')
      settings.onDraw.apply(self)
  }

  /**
   * Callback registered to mouse/touch events of the canvas
   * Stops the drawing abilities
   *
   * @private
   *
   * @param {Object} e The event object
   */
  function stopDrawing (e) {
    if (!!e && !(e.type === "touchend" || e.type == "touchcancel")) {
      drawLine(e, 1)
    } else {
      if (touchable) {
        canvas.each(function () {
          this.removeEventListener('touchmove', drawLine)
        })
      } else {
        canvas.unbind('mousemove.signaturepad')
      }

      if (output.length > 0) {
        if (settings.onDrawEnd && typeof settings.onDrawEnd === 'function')
            settings.onDrawEnd.apply(self)

        strokePoints = [];
        resetCanvas();

        drawSignature(output, canvasContext, false);
      }
    }

    previous.x = null
    previous.y = null

    if (settings.output && output.length > 0)
      $(settings.output, context).val(JSON.stringify(output))
  }

  /**
   * Draws the signature line
   *
   * @private
   */
  function drawSigLine () {
    if (!settings.lineWidth)
      return false

    canvasContext.beginPath()
    canvasContext.lineWidth = settings.lineWidth
    canvasContext.strokeStyle = settings.lineColour
    canvasContext.moveTo(settings.lineMargin, settings.lineTop)
    canvasContext.lineTo(element.width - settings.lineMargin, settings.lineTop)
    canvasContext.stroke()
    canvasContext.closePath()
  }

  function resetCanvas() {
    canvasContext.clearRect(0, 0, element.width, element.height)
    canvasContext.fillStyle = settings.bgColour
    canvasContext.fillRect(0, 0, element.width, element.height)

    if (!settings.displayOnly)
      drawSigLine()

    canvasContext.lineWidth = settings.penWidth
    canvasContext.strokeStyle = settings.penColour
  }

  /**
   * Clears all drawings off the canvas and redraws the signature line
   *
   * @private
   */
  function clearCanvas () {
    resetCanvas();
    $(settings.output, context).val('')
    output = []

    stopDrawing()
  }

  /**
   * Callback registered to mouse/touch events of the canvas
   * Draws a line at the mouse cursor location, starting a new line if necessary
   *
   * @private
   *
   * @param {Object} e The event object
   * @param {Object} o The object context registered to the event; canvas
   */
  function onMouseMove(e, o) {
    if (previous.x == null) {
      drawLine(e, 1)
    } else {
      drawLine(e, o)
    }
  }

  /**
   * Callback registered to mouse/touch events of canvas
   * Triggers the drawLine function
   *
   * @private
   *
   * @param {Object} e The event object
   * @param {Object} touchObject The object context registered to the event; canvas
   */
  function startDrawing (e, touchObject) {
    if (touchable) {
      touchObject.addEventListener('touchmove', onMouseMove, false)
    } else {
      canvas.bind('mousemove.signaturepad', onMouseMove)
    }

    // Draws a single point on initial mouse down, for people with periods in their name
    drawLine(e, 1)
  }

  /**
   * Removes all the mouse events from the canvas
   *
   * @private
   */
  function disableCanvas () {
    eventsBound = false

    canvas.each(function () {
      if (this.removeEventListener) {
        this.removeEventListener('touchend', stopDrawing)
        this.removeEventListener('touchcancel', stopDrawing)
        this.removeEventListener('touchmove', drawLine)
      }

      if (this.ontouchstart)
        this.ontouchstart = null;
    })

    $(document).unbind('mouseup.signaturepad')
    canvas.unbind('mousedown.signaturepad')
    canvas.unbind('mousemove.signaturepad')
    canvas.unbind('mouseleave.signaturepad')

    $(settings.clear, context).unbind('click.signaturepad')
  }

  /**
   * Lazy touch event detection
   * Uses the first press on the canvas to detect either touch or mouse reliably
   * Will then bind other events as needed
   *
   * @private
   *
   * @param {Object} e The event object
   */
  function initDrawEvents (e) {
    if (eventsBound)
      return false

    eventsBound = true

    // Closes open keyboards to free up space
    $('input').blur();

    if (typeof e.changedTouches !== 'undefined')
      touchable = true

    if (touchable) {
      canvas.each(function () {
        this.addEventListener('touchend', stopDrawing, false)
        this.addEventListener('touchcancel', stopDrawing, false)
      })

      canvas.unbind('mousedown.signaturepad')
    } else {
      $(document).bind('mouseup.signaturepad', function () {
        if (mouseButtonDown) {
          stopDrawing()
          clearMouseLeaveTimeout()
        }
      })
      canvas.bind('mouseleave.signaturepad', function (e) {
        if (mouseButtonDown) stopDrawing(e)

        if (mouseButtonDown && !mouseLeaveTimeout) {
          mouseLeaveTimeout = setTimeout(function () {
            stopDrawing()
            clearMouseLeaveTimeout()
          }, 500)
        }
      })

      canvas.each(function () {
        this.ontouchstart = null
      })
    }
  }

  /**
   * Triggers the abilities to draw on the canvas
   * Sets up mouse/touch events, hides and shows descriptions and sets current classes
   *
   * @private
   */
  function drawIt () {
    $(settings.typed, context).hide()
    clearCanvas()

    canvas.each(function () {
      this.ontouchstart = function (e) {
        e.preventDefault()
        mouseButtonDown = true
        initDrawEvents(e)
        startDrawing(e, this)
      }
    })

    canvas.bind('mousedown.signaturepad', function (e) {
      e.preventDefault()
      mouseButtonDown = true
      initDrawEvents(e)
      startDrawing(e)
    })

    $(settings.clear, context).bind('click.signaturepad', function (e) { e.preventDefault(); clearCanvas() })

    $(settings.typeIt, context).bind('click.signaturepad', function (e) { e.preventDefault(); typeIt() })
    $(settings.drawIt, context).unbind('click.signaturepad')
    $(settings.drawIt, context).bind('click.signaturepad', function (e) { e.preventDefault() })

    $(settings.typeIt, context).removeClass(settings.currentClass)
    $(settings.drawIt, context).addClass(settings.currentClass)
    $(settings.sig, context).addClass(settings.currentClass)

    $(settings.typeItDesc, context).hide()
    $(settings.drawItDesc, context).show()
    $(settings.clear, context).show()
  }

  /**
   * Triggers the abilities to type in the input for generating a signature
   * Sets up mouse events, hides and shows descriptions and sets current classes
   *
   * @private
   */
  function typeIt () {
    clearCanvas()
    disableCanvas()
    $(settings.typed, context).show()

    $(settings.drawIt, context).bind('click.signaturepad', function (e) { e.preventDefault(); drawIt() })
    $(settings.typeIt, context).unbind('click.signaturepad')
    $(settings.typeIt, context).bind('click.signaturepad', function (e) { e.preventDefault() })

    $(settings.output, context).val('')

    $(settings.drawIt, context).removeClass(settings.currentClass)
    $(settings.typeIt, context).addClass(settings.currentClass)
    $(settings.sig, context).removeClass(settings.currentClass)

    $(settings.drawItDesc, context).hide()
    $(settings.clear, context).hide()
    $(settings.typeItDesc, context).show()

    typeItCurrentFontSize = typeItDefaultFontSize = $(settings.typed, context).css('font-size').replace(/px/, '')
  }

  /**
   * Callback registered on key up and blur events for input field
   * Writes the text fields value as Html into an element
   *
   * @private
   *
   * @param {String} val The value of the input field
   */
  function type (val) {
    var typed = $(settings.typed, context)
      , cleanedVal = val.replace(/>/g, '&gt;').replace(/</g, '&lt;').trim()
      , oldLength = typeItNumChars
      , edgeOffset = typeItCurrentFontSize * 0.5

    typeItNumChars = cleanedVal.length
    typed.html(cleanedVal)

    if (!cleanedVal) {
      typed.css('font-size', typeItDefaultFontSize + 'px')
      return
    }

    if (typeItNumChars > oldLength && typed.outerWidth() > element.width) {
      while (typed.outerWidth() > element.width) {
        typeItCurrentFontSize--
        typed.css('font-size', typeItCurrentFontSize + 'px')
      }
    }

    if (typeItNumChars < oldLength && typed.outerWidth() + edgeOffset < element.width && typeItCurrentFontSize < typeItDefaultFontSize) {
      while (typed.outerWidth() + edgeOffset < element.width && typeItCurrentFontSize < typeItDefaultFontSize) {
        typeItCurrentFontSize++
        typed.css('font-size', typeItCurrentFontSize + 'px')
      }
    }
  }

  /**
   * Default onBeforeValidate function to clear errors
   *
   * @private
   *
   * @param {Object} context current context object
   * @param {Object} settings provided settings
   */
  function onBeforeValidate (context, settings) {
    $('p.' + settings.errorClass, context).remove()
    context.removeClass(settings.errorClass)
    $('input, label', context).removeClass(settings.errorClass)
  }

  /**
   * Default onFormError function to show errors
   *
   * @private
   *
   * @param {Object} errors object contains validation errors (e.g. nameInvalid=true)
   * @param {Object} context current context object
   * @param {Object} settings provided settings
   */
  function onFormError (errors, context, settings) {
    if (errors.nameInvalid) {
      context.prepend(['<p class="', settings.errorClass, '">', settings.errorMessage, '</p>'].join(''))
      $(settings.name, context).focus()
      $(settings.name, context).addClass(settings.errorClass)
      $('label[for=' + $(settings.name).attr('id') + ']', context).addClass(settings.errorClass)
    }

    if (errors.drawInvalid)
      context.prepend(['<p class="', settings.errorClass, '">', settings.errorMessageDraw, '</p>'].join(''))
  }

  /**
   * Validates the form to confirm a name was typed in the field
   * If drawOnly also confirms that the user drew a signature
   *
   * @private
   *
   * @return {Boolean}
   */
  function validateForm () {
    var valid = true
      , errors = {drawInvalid: false, nameInvalid: false}
      , onBeforeArguments = [context, settings]
      , onErrorArguments = [errors, context, settings]

    if (settings.onBeforeValidate && typeof settings.onBeforeValidate === 'function') {
      settings.onBeforeValidate.apply(self,onBeforeArguments)
    } else {
      onBeforeValidate.apply(self, onBeforeArguments)
    }

    if (settings.drawOnly && output.length < 1) {
      errors.drawInvalid = true
      valid = false
    }

    if ($(settings.name, context).val() === '') {
      errors.nameInvalid = true
      valid = false
    }

    if (settings.onFormError && typeof settings.onFormError === 'function') {
      settings.onFormError.apply(self,onErrorArguments)
    } else {
      onFormError.apply(self, onErrorArguments)
    }

    return valid
  }

  /**
   * Draws a 3-sized piece of the signature.  Supposed to be reused by
   * drawSignature and drawLine
   *
   * @private
   *
   * @param {Array} Array of at least `bezierSkip` * 4 points
   * @param {Object} context the canvas context to draw on
   */
  function strokePath(paths, context) {
    var showSampledPoints = false;
    /* OK, a few thoughts here:
    - if we have a signature with 250 points and we are going to draw 3 points each time,
    then we would have ~83 calls to this function .
    - I think I remembered why I didn't implement the autoscaling feature yesterday...
    it was because it is really only valid for *drawOnly* mode... think about it, the user
    draws the signature, then when drawSignature is called, the signature is centered, and
    zoomed in/out... not a good UX, so maybe autoscaling should only be enabled when
    drawOnly is enabled and it would be only part of drawSignature when called by regenerate
    function.
    */
    var bezierSkip = 4; // this program samples too fast, so even if we spline it,
                         // the result is choppy. need to throw away points or do
                         // a best fit curve of some sort. throwing away points
                         // is easier. Only use 1/bezierSkip points.
    var section = [];   // section is an array of path points that will be used
                        // to compute the bezier control points
    var sections = [];  // sections is an array of the preceding section arrays


    // Separate the sampled points into contiguous sections
    for (var i = 0; i < paths.length - 1; i++) {
      // this method of separating the contiguous paths is fucking stupid
      if (typeof(paths[i]) === 'object' && typeof(paths[i + 1]) === 'object') {
        var source = paths[i];
        var destination = paths[i + 1];

        if (source.mx == source.lx && source.my == source.ly) {
          // don't put duplicated elements in, it screws up
          // the curves. do nothing here.
          continue;
        } else {
          section.push(source);
        }

        if ( !(source.lx == destination.mx && source.ly == destination.my) &&
             !(source.mx == destination.lx && source.my == destination.ly) ) {
          // when we reach the endpoint or starting point of a signaturepad segment
          // (i.e. somewhere where the user has either STARTED clicking and dragging,
          // or somewhehire the user has lifted the mouse), one of these 2 conditions
          // is met.  save this as a separate section (so we don't try to stroke beziers
          // where the user has lifted the mouse)

          // First save the section as an independent piece in our sections array
          sections.push(section);
          // Now reset the section array to start recording the next section
          section = [];
        }

        if (i == paths.length - 2) {
          section.push(destination);
          sections.push(section);
        }
      }
    }

    /*
      Now we have sections of points that we have sampled.
      Next step is to compute the Bezier control points that will render
      curves that pass through all the sampled points.
    */

    var lengths = [];
    for (k = 0; k < sections.length; k++) {

      // Clean the sections for use. Make sure we're keeping the endpoints, and strip out every 1/bezierSkip points.
      var lastPoint = sections[k].pop();
      sections[k] = sections[k].filter(function(element, index) { return index % settings.bezierSkip == 0; });
      sections[k].push(lastPoint);

      // compute total length information so we can do some variable width stuff
      var section = sections[k];
      for (j = 0; j < section.length; j++) {
        var point = section[j];

        // city blocks distance is good enough and doesn't require squaring and square rooting
        var length = Math.abs(point.lx - point.mx) + Math.abs(point.ly - point.my);
        lengths.push(length);
        // console.log(point.lx, point.mx, point.ly , point.my);
      }
    }
    var signatureStats = stats(lengths); //stats() is in beziers.js
    signatureStats.length = numeric.sum(lengths);
    signatureStats.mean *= 3;     // the number of segments per bezier? Sort of.
    signatureStats.deviation *= 3 // this isn't accurate, but its good enough for me for today and it makes the signature pretty-ish)

    for (k = 0; k < sections.length; k++) {
      var section = sections[k];
      var simpleTuples = section.map(function(n) {return[n.lx, n.ly]});
      var beziers = getBezierControlPoints(simpleTuples);

      for (var i = 0; i < beziers.length; i++) {
        var p0 = beziers[i][0],
            p1 = beziers[i][1],
            p2 = beziers[i][2],
            p3 = beziers[i][3];

        if (settings.variableStrokeWidth === true) {
          var bezierSegmentLength = (
                    Math.abs(p0[0] - p1[0]) +
                    Math.abs(p1[0] - p2[0]) +
                    Math.abs(p2[0] - p3[0]) +
                    Math.abs(p0[1] - p1[1]) +
                    Math.abs(p1[1] - p2[1]) +
                    Math.abs(p2[1] - p3[1])
                    );
          // is this long or short compared to the average segment?
          // how many standard deviations from the mean (this data set isn't gaussian... but good enough)
          var zscore = (bezierSegmentLength - signatureStats.mean) / signatureStats.deviation;
          if (zscore > 0) {
            // fast
            var width = 3 - zscore / 2.5;
          } else if (zscore <= 0) {
            var width = 3 - zscore * 2;
          }
          // Ugh, this is straight up hacky. Basically, the distribution isn't gaussian.
          // In particular, to the downside (negative z's, the magitude of zscores tend to
          // not vary so far from the mean, but to the upside (positive z's, fast pen strokes),
          // they tend to be really big numbers, like 4+ zscores.  so this is stupidly applying
          // different scaling on both sides of zero.

          // console.log("len:", parseInt(bezierSegmentLength),'z-score:', +zscore.toFixed(3), 'width:', +width.toFixed(3));
        }

        // p0 and p3 are the start and end points of the bezier curve.
        // i want to see these plotted.
        if (showSampledPoints === true) {
          var pixelSize = 2;
          context.fillStyle = '#FF0000';
          context.fillRect(p0[0], p0[1], pixelSize, pixelSize);
          context.fillRect(p3[0], p3[1], pixelSize, pixelSize);
        }
        context.beginPath()
        context.moveTo(p0[0], p0[1])
        context.bezierCurveTo(
          p1[0], p1[1],
          p2[0], p2[1],
          p3[0], p3[1]
          );

        context.lineWidth = settings.penWidth
        context.lineWidth = width;
        context.lineCap = settings.penCap
        context.stroke()
        context.closePath();
      }
    }
  }

  /**
   * Redraws the signature on a specific canvas
   *
   * @private
   *
   * @param {Array} paths the signature JSON
   * @param {Object} context the canvas context to draw on
   * @param {Boolean} saveOutput whether to write the path to the output array or not
   */
  function drawSignature (paths, context, saveOutput) {
    if (settings.autoscale) {
      var maxX = 0,
          maxY = 0,
          minX = $(canvas).width(),
          minY = $(canvas).height();
      $.each(paths, function(idx, el) {
        maxX = Math.max(el.mx, el.lx, maxX);
        minX = Math.min(el.mx, el.lx, minX);
        maxY = Math.max(el.my, el.ly, maxY);
        minY = Math.min(el.my, el.ly, minY);
      });

      var padding = 0.15;
      maxX *= (1 + padding);
      minX *= (1 - padding);
      maxY *= (1 + padding);
      minY *= (1 - padding);
      var signatureWidth = maxX - minX;
      var signatureHeight = maxY - minY;
      var signatureAspectRatio = signatureWidth / signatureHeight;
      var canvasAspectRatio = canvas.width() / canvas.height();
      if (signatureAspectRatio > canvasAspectRatio) {
        // signature is "fat"
        // width is the constraining factor, so we need to limit this by width
        var scaleFactor = canvas.width() / signatureWidth;
      } else {
        // signature is "tall"
        var scaleFactor = canvas.height() / signatureHeight;
      }

      // there's whitespace to the top and left of the signature
      // that gets scaled. translate it back to center
      // first translate balances out the whitespace.
      // this only fixes the whitespace on the CONSTRAINING
      // dimenson.  i.e. the x axis for "fat" signatures
      context.translate(-minX * scaleFactor, -minY * scaleFactor);
      context.scale.apply(context, [scaleFactor, scaleFactor]);

      // now to center on the non-constraining dimension
      // one of these will be zero (the constraining dimension)
      // then the other gets translated to the middle
      context.translate(
        (canvas.width() / scaleFactor - signatureWidth) / 2,
        (canvas.height() / scaleFactor - signatureHeight) / 2);

    } else {
      context.scale.apply(context, settings.scale);
    }

    for(var i = 0; i < paths.length; i++) {
      if (typeof paths[i] === 'object') {

        if (settings.drawBezierCurves === false) {
          context.beginPath()
          context.moveTo(paths[i].mx, paths[i].my)
          context.lineTo(paths[i].lx, paths[i].ly)
          context.lineCap = settings.penCap
          context.stroke()
          context.closePath()
        }

        if (saveOutput) {
          output.push({
            'lx' : paths[i].lx
            , 'ly' : paths[i].ly
            , 'mx' : paths[i].mx
            , 'my' : paths[i].my
          })
        }
      }
    } /* end linear segments */

    if (settings.drawBezierCurves === true) {
      strokePath(paths, context);
    } /* end bezier curves */
  }

  /**
   * Initialisation function, called immediately after all declarations
   * Technically public, but only should be used internally
   *
   * @private
   */
  function init () {
    // Fixes the jQuery.fn.offset() function for Mobile Safari Browsers i.e. iPod Touch, iPad and iPhone
    // https://gist.github.com/661844
    // http://bugs.jquery.com/ticket/6446
    if (parseFloat(((/CPU.+OS ([0-9_]{3}).*AppleWebkit.*Mobile/i.exec(navigator.userAgent)) || [0,'4_2'])[1].replace('_','.')) < 4.1) {
       $.fn.Oldoffset = $.fn.offset;
       $.fn.offset = function () {
          var result = $(this).Oldoffset()
          result.top -= window.scrollY
          result.left -= window.scrollX

          return result
       }
    }

    // Disable selection on the typed div and canvas
    $(settings.typed, context).bind('selectstart.signaturepad', function (e) { return $(e.target).is(':input') })
    canvas.bind('selectstart.signaturepad', function (e) { return $(e.target).is(':input') })

    if (!element.getContext && FlashCanvas)
      FlashCanvas.initElement(element)

    if (element.getContext) {
      canvasContext = element.getContext('2d')

      $(settings.sig, context).show()

      if (!settings.displayOnly) {
        if (!settings.drawOnly) {
          $(settings.name, context).bind('keyup.signaturepad', function () {
            type($(this).val())
          })

          $(settings.name, context).bind('blur.signaturepad', function () {
            type($(this).val())
          })

          $(settings.drawIt, context).bind('click.signaturepad', function (e) {
            e.preventDefault()
            drawIt()
          })
        }

        if (settings.drawOnly || settings.defaultAction === 'drawIt') {
          drawIt()
        } else {
          typeIt()
        }

        if (settings.validateFields) {
          if ($(selector).is('form')) {
            $(selector).bind('submit.signaturepad', function () { return validateForm() })
          } else {
            $(selector).parents('form').bind('submit.signaturepad', function () { return validateForm() })
          }
        }

        $(settings.sigNav, context).show()
      }
    }
  }

  $.extend(self, {
    /**
     * Initializes SignaturePad
     */
    init : function () { init() }

    /**
     * Allows options to be updated after initialization
     *
     * @param {Object} options An object containing the options to be changed
     */
    , updateOptions : function (options) {
      $.extend(settings, options)
    }

    /**
     * Regenerates a signature on the canvas using an array of objects
     * Follows same format as object property
     * @see var object
     *
     * @param {Array} paths An array of the lines and points
     */
    , regenerate : function (paths) {
      self.clearCanvas()
      $(settings.typed, context).hide()

      if (typeof paths === 'string')
        paths = JSON.parse(paths)

      drawSignature(paths, canvasContext, true)

      if (settings.output && $(settings.output, context).length > 0)
        $(settings.output, context).val(JSON.stringify(output))
    }

    /**
     * Clears the canvas
     * Redraws the background colour and the signature line
     */
    , clearCanvas : function () { clearCanvas() }

    /**
     * Returns the signature as a Js array
     *
     * @return {Array}
     */
    , getSignature : function () { return output }

    /**
     * Returns the signature as a Json string
     *
     * @return {String}
     */
    , getSignatureString : function () { return JSON.stringify(output) }

    /**
     * Returns the signature as an image
     * Re-draws the signature in a shadow canvas to create a clean version
     *
     * @return {String}
     */
    , getSignatureImage : function () {
      var tmpCanvas = document.createElement('canvas')
        , tmpContext = null
        , data = null

      tmpCanvas.style.position = 'absolute'
      tmpCanvas.style.top = '-999em'
      tmpCanvas.width = element.width
      tmpCanvas.height = element.height
      document.body.appendChild(tmpCanvas)

      if (!tmpCanvas.getContext && FlashCanvas)
        FlashCanvas.initElement(tmpCanvas)

      tmpContext = tmpCanvas.getContext('2d')

      tmpContext.fillStyle = settings.bgColour
      tmpContext.fillRect(0, 0, element.width, element.height)
      tmpContext.lineWidth = settings.penWidth
      tmpContext.strokeStyle = settings.penColour

      drawSignature(output, tmpContext)
      data = tmpCanvas.toDataURL.apply(tmpCanvas, arguments)

      document.body.removeChild(tmpCanvas)
      tmpCanvas = null

      return data
    }

    /**
     * The form validation function
     * Validates that the signature has been filled in properly
     * Allows it to be hooked into another validation function and called at a different time
     *
     * @return {Boolean}
     */
    , validateForm : function () { return validateForm() }
  })
}

/**
 * Create the plugin
 * Returns an Api which can be used to call specific methods
 *
 * @param {Object} options The options array
 *
 * @return {Object} The Api for controlling the instance
 */
$.fn.signaturePad = function (options) {
  var api = null

  this.each(function () {
    if (!$.data(this, 'plugin-signaturePad')) {
      api = new SignaturePad(this, options)
      api.init()
      $.data(this, 'plugin-signaturePad', api)
    } else {
      api = $.data(this, 'plugin-signaturePad')
      api.updateOptions(options)
    }
  })

  return api
}

/**
 * Expose the defaults so they can be overwritten for multiple instances
 *
 * @type {Object}
 */
$.fn.signaturePad.defaults = {
  defaultAction : 'typeIt' // What action should be highlighted first: typeIt or drawIt
  , displayOnly : false // Initialize canvas for signature display only; ignore buttons and inputs
  , drawOnly : false // Whether the to allow a typed signature or not
  , canvas : 'canvas' // Selector for selecting the canvas element
  , sig : '.sig' // Parts of the signature form that require Javascript (hidden by default)
  , sigNav : '.sigNav' // The TypeIt/DrawIt navigation (hidden by default)
  , bgColour : '#ffffff' // The colour fill for the background of the canvas; or transparent
  , penColour : '#145394' // Colour of the drawing ink
  , penWidth : 2 // Thickness of the pen
  , penCap : 'round' // Determines how the end points of each line are drawn (values: 'butt', 'round', 'square')
  , lineColour : '#ccc' // Colour of the signature line
  , lineWidth : 2 // Thickness of the signature line
  , lineMargin : 5 // Margin on right and left of signature line
  , lineTop : 35 // Distance to draw the line from the top
  , name : '.name' // The input field for typing a name
  , typed : '.typed' // The Html element to accept the printed name
  , clear : '.clearButton' // Button for clearing the canvas
  , typeIt : '.typeIt a' // Button to trigger name typing actions (current by default)
  , drawIt : '.drawIt a' // Button to trigger name drawing actions
  , typeItDesc : '.typeItDesc' // The description for TypeIt actions
  , drawItDesc : '.drawItDesc' // The description for DrawIt actions (hidden by default)
  , output : '.output' // The hidden input field for remembering line coordinates
  , currentClass : 'current' // The class used to mark items as being currently active
  , validateFields : true // Whether the name, draw fields should be validated
  , errorClass : 'error' // The class applied to the new error Html element
  , errorMessage : 'Please enter your name' // The error message displayed on invalid submission
  , errorMessageDraw : 'Please sign the document' // The error message displayed when drawOnly and no signature is drawn
  , onBeforeValidate : null // Pass a callback to be used instead of the built-in function
  , onFormError : null // Pass a callback to be used instead of the built-in function
  , onDraw : null // Pass a callback to be used to capture the drawing process
  , onDrawEnd : null // Pass a callback to be exectued after the drawing process
  , scale: [1, 1] // Canvas scale for X and Y respectivately
  , autoscale: false // Autoscale the signature size if rendered onto a different sized canvas,
  , drawBezierCurves: false // Render smoother signatures using Bezier curves that pass through all the sampled points. Bezier curves are the new hot stuff, but lets let the default behavior be the original for now
                            // Original default behavior -- linear interpolation between sampled points for rendering signature
  , variableStrokeWidth: false // Vary the width of the line segments based on estimated "speed"
  , bezierSkip: 4, // Too many sample points make the beziers still squiggly, so skip some. The more you skip, the more the shape gets distorted from the sample, but the smoother the loops will look.  It may do a poor job with rendering the maxima/minima though.
                   // TODO: Ideally you actually don't skip ARBITRARY points, but you figure out which points are higher value.  for example, max and max y, min x and min y within a segment will tell you how far out the mouse ACTUALLY went.  if you skip the apexes
                   // It will make the signature render poorly.  This is an improvement for later.
                   // this program samples too fast, so even if we spline it,
                   // the result is choppy. need to throw away points or do
                   // a best fit curve of some sort. throwing away points
                   // is easier. Only use 1/bezierSkip points. Also reduces computational effort.
}

}(jQuery))
