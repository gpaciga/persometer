# Persometer

A JavaScript library for creating personality tests or other decision-making surveys based on agree/disagree statements. Rhymes with "thermometer".

The main features are:

1. Allows arbitrary overlap between statements and possible results; agreeing to one statement can simultaneously make multiple results more or less likely.
2. Displays the distribution of results; users can see not only what their strongest match is, but also how strongly they rated against each other possible result.

Requires JQuery and a modern browser.

See `demo.html` for an example.

## Usage

A new personality test is initialized by passing a config object with three required parameters:

```
const test = Persometer({ container, statements, personas });
test.render();
```

where `container` is the `id` of the element into which the test will render.

Optionally, there are two helper functions for survey writers:

1. A validation function is provided that will test your configuration and output any errors to the console. This is not an exhaustive test but just validates some basics.
2. A statistics function that will estimate the distribution of personas your users will get if they answer each statement at random.

```
test.validate();
test.statistics();
```

Check the console log for the output of these.


## Configuration

### Statements

Statements are an array of objects with two fields:

* `statements[].text` is the statement displayed to the user that they will agree or disagree with
* `statements[].scores` defines how many points to allocate towards each persona when the user agrees or disagrees.

Agreement will add the scores towards each possible persona, disagreement will subtract them.

If `scores` is an array of numbers, the index of each number corresponse with the index of the `personas` array. I.e., if
`scores = [0, 2, 0, 1]`, agreement with the statement will add two points to the 2nd persona in the `personas` array, and
add one point to the 4th persona.

If `scores` is an object, its keys must each correspond to the `id` of a persona object, and the value to the incremental score.
e.g. if `scores = {"apples": 1}`, then one point will be added to the persona with `id = "apples"`.

### Personas

Personas is an array of personality types that the user is being sorted into.

| Property      | Required | Description                                                         |
| ------------- | -------- | ------------------------------------------------------------------- |
| `name`        | required | The name or title of this persona.                                 |
| `description` | required | Flavour text that will be displayed if the user gets this persona. |
| `id`          | optional | Used if any `statements[].scores` are specific as an object.        |
| `img`         | optional | Displayed as part of the user's result if specified.                |

### Additional options

An optional 4th config object, `options`, can tweak the behaviour further. For example:

```
const options = {
    title: "..."
};
const test = Persometer({ container, statements, personas, options });
```

Available options are:

| Option   | Type | Behaviour |
| -------- | ---- | --------- |
| `title`  | String | Adds additional markup at the top of the container, e.g. to display the question being answered. |

### Styling

The included `demo.html` uses the provided `persometer.css` to provide some very minimal styling.

Bootstrap is supported, shown in `demo.bootstrap.html`. In this case, use the included `persometer.bootstrap.css`.
