# Examples

[CAPTURING A DRAWN SIGNATURE](http://ezl.github.io/signature-pad/) -- 3 examples:
* the original implementation
* smoothed
* smoothed+variable width

[REGENERATING A RECORDED SIGNATURE](http://ezl.github.io/signature-pad/regeneration.html) -- 3 examples, all 3 of these are generating from the same data:
* The first creates the signature by drawing straight line segments between sampled points
* The second renders a cubic spline that passes through all of the sampled points
* The third does the same as the second, but changes the width of the signature in response to perceived stroke velocity


## Fork by EZL of Thomas Bradley's excellent signature drawing package.

SignaturePad makes it possible for developers to embed an HTML5 canvas in a website that records mouse (or touch) drawn signatures, then re-renders them later.

The primary use case, for me, is to include a "signing" component to online rental applications and leases for my company, [Rent Application](https://www.rentapplication.net).

Original README/documentation below my added commentary, [check out the original](https://github.com/thomasjbradley/signature-pad/)

## Improvements

I made a few additions to the original library:

* Signature smoothing
* Variable signature width
* Autoresizing

### Signature Smoothing

This was the major thing I wanted to accomplish.

This follows [the method outlined by Square](http://corner.squareup.com/2012/07/smoother-signatures.html)
for generating smooth signatures, with a few omissions.

### Variable signature width

Draw skinnier lines with the pen is moving faster. Draw fatter lines when the
pen is moving slower. Basically: "What would it look like if signed with a
fountain pen?"

### Auto resizing

Signatures may be drawn and rendered/re-rendered on devices of different sizes.
The original libary specifies canvas dimensions in pixels, which can either:

1. force the signature canvas to be wider than the viewport, which can either
   require the user to use horizontal scroll to view the signature or be unviewable
   on mobile devices.
2. if the rendered canvas is smaller than the canvas on which the signature was
   captured, parts of the signature aren't rendered (or rather, they're rendered
   off of the regenerated canvas, and therefore aren't visible to the user)

This fork introduces an **autoscale** flag (*default: false, mirroring the
original libraries behavior*), which guarantees that the full signature can
be rendered on the new canvas, of any size.

The **autoscale** flag will shrink OR grow the signature to fit the canvas on
which it is being regenerated.

To do so, it finds the actual dimensions of the *recorded* signature, then pads
it, remaps it to the new dimensions using html5 canvas's scale.apply() method,
then centers the recorded signature on the new canvas.

The centering action could be controversial ("hey, I WANTED to only sign in the
upper left corner!"), but for my purposes it makes sense and I think it serves
most normal signature signing scenarios.

## Notable differences/hacks between Square & this fork:

### The basic method is the same:

1. Find sampled points
2. Compute b-spline points and then beziers which will render a cubic spline through
   all of the sampled points.

That alone will give a smoothed signature.

### But this implementation is slightly different:

1. **Run the spline through only a subset of the points** : 
   The sampling rate of the original library is really fast.  As a result, there
   are a ton of sampled points, and due to noise in sampling the location of the
   mouse / non-smooth user mouse behavior, if you render cubic splines through
   ALL the points, its "smooth" (there are no sharp angles), but the
   rendered curve is "squiggly" (looks like someone wrote it with a shaky hand).
   I completely arbitrarily decided on using 1 in 4 points for sampling.
2. **Distance as a proxy for velocity** : 
   Square uses this to determine how thick to stroke a path, giving the signatures
   variable stroke width throughout the rendered pen path, which is a surprisingly
   nice, elegant feel -- like the user is drawing with a fountain pen.
   The Square implementation samples points and timestamps as a tuple. Since the
   original signaturepad implementation does that and ... uh... i'm lazy...
   I opted to use distance between points as a proxy for speed.  Makes assumptions
   that the sampling rate will be relatively constant and that "city block"
   distance is a good proxy for the true path length. (It's not really, but
   for these small sampling differences, I think the qualitative difference is
   probably sufficient and doesn't warrant the additional overhead of computing
   bezier lengths.  Also, its only going in my project for now, so I'm doing 
   whatever I want.)
3. **Roll your own bezier drawing algorithm** : 
   Square is fancier than me. I'm using HTML5 canvas's built in bezier drawing
   method.  They rolled their own.  There are a few reasons/differences:

    1. Square is designing for native mobile apps -- I don't know if that
       includes an easy bezier drawing method.  I'm designing for modern 
       browsers, which include html5 canvas's built in method.
    2. Square's implementation lets them vary the stroke width WITHIN a single
       bezier segment. This lets their width changes be fluid, while mine are
       disjoint and can only change width between segments.  It's imperfect,
       but god enough for me.


## Improvements

A few ideas for improvements:

* **Max amplitude** Rather than sampling every 4th point, It'd be nice to take
  segments, then guarantee that you're including the max-x, max-y, min-x, min-y
  points.  This ensures that you're not cutting out points that are at the
  boundaries of the signature.  Since I am NOT doing this now, it reduces the
  amplitude of the stroke (loops are rendered smaller, peaks are lower).

* **better variable width** Include more points and smooth it differently
  (best fit) or, like Square, roll our own bezier plotter. There are methods
  for efficiently rendering bezier curves given the control points, so this is
  possible.
* **best fit through all the points** Instead of the uniform sampling.  Signers
  using a mouse tend to have a hard time drawing smooth signatures because the
  device itself is awkward. As a result, even smoothed signatures made by
  forcing splines through all the control points aren't "beautiful".  Unfortunately
  this is only useful on mouse devices -- on touch devices, people are great at
  drawing smooth signatures.  A lot of work, for little gain.
* **Timestamps in sampling** As mentioned above, this method is using distance
  as a proxy for velocity.  Obv with timestamp and position, we have a better sense
  of velocity (Though we still won't know the actual path taken between 2 points,
  so we're still not sure about velocity).


# Signature Pad
SignaturePad: A jQuery plugin for assisting in the creation of an HTML5 canvas based signature pad. Records the drawn signature in JSON for later regeneration.

Copyright MMXI, Thomas J Bradley, <hey@thomasjbradley.ca>

Dependencies: FlashCanvas/1.5, json2.js, jQuery/1.3.2+

Versioned using Semantic Versioning, <http://semver.org/>

## Quick Start
1. Include `jquery.signaturepad.css`, `flashcanvas.js`, `jquery.js`, `jquery.signaturepad.js`, `json2.js` in your HTML file
2. Create the HTML, following the example: <https://github.com/thomasjbradley/signature-pad/blob/master/examples/accept-signature.html>
3. `$('.sigPad').signaturePad();`
4. Remember that [most things are configurable](http://thomasjbradley.ca/lab/signature-pad#options)

## Complete Documentation
<http://thomasjbradley.ca/lab/signature-pad>

## Examples
- [Accepting a Signature](https://github.com/thomasjbradley/signature-pad/blob/master/examples/accept-signature.html)
- [Requiring a Drawn Signature](https://github.com/thomasjbradley/signature-pad/blob/master/examples/require-drawn-signature.html)
- [Regenerating a Signature](https://github.com/thomasjbradley/signature-pad/blob/master/examples/regenerate-signature.html)
- [Accepting Multiple Signatures](https://github.com/thomasjbradley/signature-pad/blob/master/examples/accept-multiple-signatures.html)

## Demos
- [Accepting a Signature](http://thomasjbradley.ca/lab/signature-pad-accept)
- [Requiring a Drawn Signature](http://thomasjbradley.ca/lab/signature-pad-require-drawn)
- [Regenerating a Signature](http://thomasjbradley.ca/lab/signature-pad-regenerate)

## Converting to an Image
<http://thomasjbradley.ca/lab/signature-pad/#images>

## Source Code
<http://github.com/thomasjbradley/signature-pad>

## License
Signature Pad is licensed under the [New BSD license](https://github.com/ezl/signature-pad/blob/master/LICENSE.txt).

All dependencies: jQuery, json2.js, and FlashCanvas retain their own licenses.
