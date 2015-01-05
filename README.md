## jQuery SmartCrop

*by Greg Schoppe ([gschoppe.com](http://gschoppe.com))*

Demo: [gschoppe.com/projects/jQuery.smartCrop](http://gschoppe.com/projects/jQuery.smartCrop)

jQuery plugin enabling client-side responsive image rendering.  Just define widths and heights for image files, using responsive CSS, and SmartCrop will resize and crop the image to best match the defined size.

**Important Note:** jQuery SmartCrop is currently a proof of concept.  Resource usage is currently very high, and the algorithms used are NOT yet optimized in ANY way.  **This plugin is NOT yet recommended for use in ANY production site**

## Usage

All settings are optional.  focus and maxReduce can be overridden on a per-image basis with html5 data attributes `data-focusx`, `data-focusy`, and `data-maxreduce`.

    $('img').smartCrop({
        weight   : .3,           // weight between color method (0) and entropy method (1)
        focus    : [null, null], // percent of width and percent of height aka {.5,.5} for image focal point (if not set, focus will be determined automatically)
        maxReduce: .33,          // maximum reduction ratio before cropping
        testSize : 200,          // pixel size of test canvas (used to determine focus automatically.  smaller sizes are faster, but less accurate)
        slices   : 20,           // number of slices to sample (used to determine focus automatically.  smaller sizes are faster, but less accurate)
        debug    : false         // enable debugging mode to display console information and focus point overlay
    });

## Change Log

* 01/04/2015 - First functioning proof of concept