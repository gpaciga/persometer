const Persometer = config => {

    const CONTAINERID = config.container;
    const STATEMENTS = config.statements;
    const CATEGORIES = config.categories;

    // todo: make it look nice by default
    // todo: option to normalize scores 0-1 instead of -1,1
    // todo: option so disagree doesn't subtract the scores
    // todo: option to use either/or instead of agree/disagree (since the math is all the same)
    // todo: option to specify whether all answers are required or not
    // todo: option to not normalize scores when picking the winner
    // todo: option to randomize statement order
    // todo: Myers-Briggs option: N "results" categories, +/- result determine each extreme, combine into 2^N types

    const CATEGORY_TO_INDEX = categories.reduce((map, category, index) => {
        if (category.id) {
            map[category.id] = index;
        }
        return map;
    }, {});

    // If scores is given as an object, map it to an array using the key as a category id
    statements.forEach(statement => {
        if (statement.scores instanceof Array) { return; }
        const scores = Array(CATEGORIES.length).fill(0);
        Object.keys(statement.scores).forEach(key => {
            const index = CATEGORY_TO_INDEX[key];
            scores[index] = statement.scores[key];
        });
        statement.scores = scores;
    });

    /**
     * Run some checks of the input parameters above to make sure they're all OK
     * Errors will just be logged to console. In the future we may throw an error.
     */
    const validate = () => {
        const tests = [
            function statements_have_right_score_lengths() {
                let pass = true;
                STATEMENTS.forEach(s => {
                    const scoreLength = s.scores.length;
                    if (scoreLength != CATEGORIES.length) {
                        console.error(`NOT OK: Invalid score length ${scoreLength} for statement ${s}, should be ${CATEGORIES.length}`);
                        pass = false;
                    }
                });
                if (pass) { console.log("OK: statement score lengths"); }
            },
            function all_results_have_nonzero_score() {
                const maxima = get_maximum_scores();
                const zeros = maxima.filter(x => x == 0);
                if (zeros.length > 0) {
                    console.error("NOT OK: Found zeros in the maximum scores:", maxima);
                } else {
                    console.log("OK: all results have some scores allocated");
                }
            },
            function category_ids_are_unique() {
                let pass = true;
                const foundIds = [];
                CATEGORIES.forEach(category => {
                    if (category.id && foundIds.indexOf(category.id) === -1) {
                        foundIds.push(category.id);
                    } else {
                        console.error(`NOT OK: category id ${category.id} used multiple times`);
                        pass = false;
                    }
                });
                if (pass) { console.log("OK: category ids are unique"); }
            }
        ];
        tests.forEach(test => test());
    };

    /**
     * Checks if there's a result code in the URL's query parameters, and if so
     * generates the set of answers that would have created that result. If no
     * code is present, returns false.
     * @param {string} href
     */
    const get_answers_from_url = (href) => {
        const url = new URL(href);
        const r = url.searchParams.get("r");
        if (!r) { return false; }

        const answers = [];
        const params = r.split("&");
        params.forEach(p => {
            const answer = p.split("=");
            answers.push({name: answer[0], value: answer[1]})
        });
        return answers;
    };

    /**
     * Update the URL to reflect the user's unique result in a query parameter,
     * so it can be easily copied and shared (or refreshed during development).
     * @param {*} value
     */
    const set_result_code = value => {
        const url = new URL(window.location.href);
        url.searchParams.set("r", value);
        window.history.pushState(null, document.title, url.href);
    };

    /**
     * Renders all the agree/disagree statements as a submittable form.
     * @param {string} id of the container to render into
     */
    const render_statements = (id) => {
        const div = document.getElementById(id);
        $(div).empty();
        const form = document.createElement("form");

        // While submitting a form would put the answers into the query params
        // by default anyway, the idea here is to eventually replace the full
        // form data with a code that can be decoded into just the results,
        // instead of including each individual answer.
        const handle_submit = (form, event) => {
            event.preventDefault(); // dont refresh the page
            set_result_code($(form).serialize());
            render_result(CONTAINERID, $(form).serializeArray());
        };

        form.onsubmit = handle_submit.bind(this, form);
        div.append(form);

        STATEMENTS.forEach((statement, index) => {
            $(form).append(`
                <div class="statement">
                    <div class="statement-text">${statement.text}</div>
                    Agree <input type="radio" name="${index}" value="1">
                    Disagree <input type="radio" name="${index}" value="-1">
                </div>
            `);
        })

        $(form).append('<input type="submit" />');
    };

    /**
     * Renders the result based on the user's answer, including the best match
     * and the relative scores in each category.
     * @param {string} id of the container to render into
     * @param {Object[]} answers the array of answers
     */
    const render_result = (id, answers) => {
        const div = document.getElementById(id);
        $(div).empty();
        $(div).append('<strong>Your result is:</strong><br/>')
        scores = add_scores(answers);
        render_best_match(div, scores);
        render_scores(div, scores);

        const resetButton = document.createElement('input');
        resetButton.type = "button";
        resetButton.onclick = reset;
        resetButton.value = "Start over";
        $(div).append(resetButton);
    };

    /**
     * Sums up the score arrays for each statement, adding the score if the
     * user agreed with the statement or subtracting the score if they
     * disagreed.
     * @param {Object[]} answers the array of answers
     */
    const add_scores = answers => {
        const total = new Array(CATEGORIES.length).fill(0);

        // if skipped, the statement id just won't appear in this list, so effectively coefficient=0
        answers.forEach(answer => {
            const coefficient = Number(answer.value);
            const statement = STATEMENTS[Number(answer.name)];
            const scores = statement.scores;
            for (i = 0; i < CATEGORIES.length; i++) {
                total[i] += coefficient * scores[i];
            }
        });

        return total;
    };

    /**
     * Returns an array containing the maximum possible score in each category,
     * for use in normalizing the scales.
     */
    const get_maximum_scores = () => {
        const maxima = new Array(CATEGORIES.length).fill(0);
        STATEMENTS.forEach(s => {
            for (i = 0; i < CATEGORIES.length; i++) {
                maxima[i] += Math.abs(s.scores[i])
            }
        });
        return maxima;
    };

    /**
     * Normalizes the actually scores based on the maximum possible range in
     * each category, independently. If the user agrees to every statement,
     * this will return an array of 1s. If the user disagrees with every
     * statement, this will return an array of -1s.
     * @param {number[]} raw_total in each category
     */
    const normalize_results = raw_total => {
        // need to calculate the range of each possible answer
        const maxima = get_maximum_scores();

        // then normalize
        const normalized = [];
        for (i = 0; i < CATEGORIES.length; i++) {
            normalized.push(raw_total[i] / maxima[i]);
        }

        // now an array of scores ranging from -1 to 1
        return normalized;
    };

    /**
     * Returns the category object that the answers best match.
     * @param {number[]} scores for each category
     */
    const get_best_result = scores => {
        // ignoring ties and using the first match
        const ibest = scores.indexOf(Math.max(...scores));
        return CATEGORIES[ibest];
    };

    /**
     * Renders a blurb for the user's highest category given the scores.
     * @param {Element} container to render the scores into
     * @param {number[]} scores for each category
     */
    const render_best_match = (container, scores) => {
        const match = get_best_result(scores);
        $(container).append(`<p><strong>${match.name}</strong></p>`);
        $(container).append(`<p>${match.description}</p>`);
    };

    /**
     * Writes out the table of each possible category and how the person scored.
     * @param {Element} container to render the scores into
     * @param {number[]} scores for each category
     */
    const render_scores = (container, scores) => {
        const normalized_scores = normalize_results(scores);
        for (i = 0; i < CATEGORIES.length; i++) {
            const value = normalized_scores[i];
            $(container).append(`<p><strong>${CATEGORIES[i].name}</strong>: ${score_meter_markup(value)}</p>`);
        }
    };

    /**
     * Renders a visual meter that is filled up based on the given value.
     * @param {number} value from -1 to 1
     */
    const score_meter_markup = value => {

        // Not very accessible since this is pure CSS, no readable text yet
        const empty_left = `<span style="display: inline-block; height: 10px; width: 100px; margin: 0; background-color: lightgrey; border-right: 1px solid black"></span>`;
        const empty_right = `<span style="display: inline-block; height: 10px; width: 100px; margin: 0; background-color: lightgrey; border-left: 1px solid black"></span>`;
        const score = `<span style="display: inline-block; height: 10px; background-color: red; width: ${Math.abs(value)*100}px; margin: 0;"></span>`;
        const remaining = `<span style="display: inline-block; height: 10px; background-color: lightgrey; width: ${100 - Math.abs(value)*100}px; margin: 0;"></span>`;

        let meter = "";
        if (value > 0) {
            meter = `${empty_left}${score}${remaining}`;
        } else if (value < 0) {
            meter = `${remaining}${score}${empty_right}`;
        } else {
            meter = `${empty_left}${remaining}`;
        }

        return `
            <span style="height: 10px; width: 201px; display: inline-block">${meter}</span>
        `;
    };

    /**
     * Renders either the statements or the results, depending on whether the
     * url has a result code in it.
     */
    const render = () => {
        const answers = get_answers_from_url(window.location.href);
        if (answers) {
            render_result(CONTAINERID, answers);
        } else {
            render_statements(CONTAINERID);
        }
    };

    /**
     * Clear any results and render the original questionnaire.
     */
    const reset = () => {
        set_result_code("");
        render_statements(CONTAINERID);
    };

    return {
        render: render,
        reset: reset,
        validate: validate,
    }
};
