const Persometer = config => {

    const CONTAINERID = config.container;
    const STATEMENTS = config.statements;
    const PERSONAS = config.personas;
    const OPTIONS = config.options || {};

    // todo: handle ties
    // todo: option to normalize scores 0-1 instead of -1,1
    // todo: option so disagree doesn't subtract the scores
    // todo: option to use either/or instead of agree/disagree (since the math is all the same)
    // todo: option to specify whether all answers are required or not
    // todo: option to not normalize scores when picking the winner
    // todo: option to randomize statement order
    // todo: option to display both agreement and disagreement in meter instead of just net agreement
    // todo: Myers-Briggs option: N personas, +/- result determine each extreme, combine into 2^N types
    // bug: back button might not work when on result page?

    // Mappign to be used if we need to map scores to a persona by ID instead of index
    const PERSONAID_TO_INDEX = PERSONAS.reduce((map, persona, index) => {
        if (persona.id) {
            map[persona.id] = index;
        }
        return map;
    }, {});

    // If scores is given as an object, map it to an array using the key as a persona id
    // Don't like that this changes the input object
    statements.forEach(statement => {
        if (statement.scores instanceof Array) { return; }
        const scores = Array(PERSONAS.length).fill(0);
        Object.keys(statement.scores).forEach(key => {
            const index = PERSONAID_TO_INDEX[key];
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
                    if (scoreLength != PERSONAS.length) {
                        console.error(`NOT OK: Invalid score length ${scoreLength} for statement ${s}, should be ${PERSONAS.length}`);
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
            function persona_ids_are_unique() {
                let pass = true;
                const foundIds = [];
                PERSONAS.forEach(persona => {
                    if (persona.id && foundIds.indexOf(persona.id) === -1) {
                        foundIds.push(persona.id);
                    } else {
                        console.error(`NOT OK: persona id ${persona.id} used multiple times`);
                        pass = false;
                    }
                });
                if (pass) { console.log("OK: persona ids are unique"); }
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
     * Clear the contents of the Persometer container div, returning the new
     * container that we can append to.
     */
    const reset_contents = (id) => {
        const div = document.getElementById(id);
        $(div).empty();
        $(div).append(`<div id="persometer-container-${id}" class="container persometer"></div>`);
        const container = $(`#persometer-container-${id}`);

        if (OPTIONS.title) {
            $(container).append(`
                <div class="row">
                    <div class="col-12">
                        ${OPTIONS.title}
                    </div>
                </div>
            `);
        }

        return container;
    }

    /**
     * Renders all the agree/disagree statements as a submittable form.
     * @param {string} id of the container to render into
     */
    const render_statements = (id) => {
        const container = reset_contents(id);
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
        container.append(form);

        STATEMENTS.forEach((statement, index) => {
            $(form).append(`
                <div class="row persometer-statement">
                    <div class="col-md-8 col-sm-7 persometer-statement-text">${statement.text}</div>

                    <div class="col-md-4 col-sm-5 btn-group btn-group-toggle persometer-statement-options" data-toggle="buttons">
                        <label class="btn btn-secondary persometer-option persometer-agree">
                            <input type="radio" name="${index}" id="${index}" value="1"> Agree
                        </label>
                        <label class="btn btn-secondary persometer-option persometer-disagree">
                            <input type="radio" name="${index}" id="${index}" value="-1"> Disagree
                        </label>
                    </div>

                </div>
            `);
        })

        $(form).append('<div class="row persometer-submit"><div class="col-12"><input class="btn btn-primary btn-block persometer-button" type="submit" /></div></div>');
    };

    /**
     * Renders the result based on the user's answer, including the best match
     * and the relative scores for each persona.
     * @param {string} id of the container to render into
     * @param {Object[]} answers the array of answers
     */
    const render_result = (id, answers) => {
        const container = reset_contents(id);
        scores = add_scores(answers);
        render_best_match(container, scores);
        render_scores(container, scores);


        const resetButton = document.createElement('input');
        resetButton.type = "button";
        resetButton.className = "btn btn-primary btn-block persometer-button"
        resetButton.onclick = reset;
        resetButton.value = "Start over";

        $(container).append(`
            <div class="row persometer-reset">
                <div class="col-12">`,
                    resetButton,
                `</div>
            </div>
        `);

        $(container).append(resetButton);
    };

    /**
     * Sums up the score arrays for each statement, adding the score if the
     * user agreed with the statement or subtracting the score if they
     * disagreed.
     * @param {Object[]} answers the array of answers
     */
    const add_scores = answers => {
        const total = new Array(PERSONAS.length).fill(0);

        // if skipped, the statement id just won't appear in this list, so effectively coefficient=0
        answers.forEach(answer => {
            const coefficient = Number(answer.value);
            const statement = STATEMENTS[Number(answer.name)];
            const scores = statement.scores;
            for (i = 0; i < PERSONAS.length; i++) {
                total[i] += coefficient * scores[i];
            }
        });

        return total;
    };

    /**
     * Returns an array containing the maximum possible score for each persona,
     * for use in normalizing the scales.
     */
    const get_maximum_scores = () => {
        const maxima = new Array(PERSONAS.length).fill(0);
        STATEMENTS.forEach(s => {
            for (i = 0; i < PERSONAS.length; i++) {
                maxima[i] += Math.abs(s.scores[i])
            }
        });
        return maxima;
    };

    /**
     * Normalizes the actually scores based on the maximum possible range for
     * each persona, independently. If the user agrees to every statement,
     * this will return an array of 1s. If the user disagrees with every
     * statement, this will return an array of -1s.
     * @param {number[]} raw_total for each persona
     */
    const normalize_results = raw_total => {
        // need to calculate the range of each possible answer
        const maxima = get_maximum_scores();

        // then normalize
        const normalized = [];
        for (i = 0; i < PERSONAS.length; i++) {
            normalized.push(raw_total[i] / maxima[i]);
        }

        // now an array of scores ranging from -1 to 1
        return normalized;
    };

    /**
     * Returns the persona object that the answers best match.
     * @param {number[]} scores for each persona
     */
    const get_best_result = scores => {
        // ignoring ties and using the first match
        const ibest = scores.indexOf(Math.max(...scores));
        return PERSONAS[ibest];
    };

    /**
     * Renders a blurb for the user's highest persona given the scores.
     * @param {Element} container to render the scores into
     * @param {number[]} scores for each persona
     */
    const render_best_match = (container, scores) => {
        const match = get_best_result(scores);

        let img = "";
        if (match.image) {
            img = `<div class="col"><img src="${match.image}" alt="" class="persometer-result-image" /></div>`;
        }

        const markup = `
            <div class="row persometer-result">
                ${img}
                <div class="col">
                    <h3 class="persometer-result-name">${match.name}</h3>
                    <p class="persometer-result-desc">${match.description}</p>
                </div>
            </div>
        `;
        $(container).append(markup);
    };

    /**
     * Writes out the table of each possible persona and how the person scored.
     * @param {Element} container to render the scores into
     * @param {number[]} scores for each persona
     */
    const render_scores = (container, scores) => {
        const normalized_scores = normalize_results(scores);
        let markup = `<div class="persometer-breakdown">`;
        for (i = 0; i < PERSONAS.length; i++) {
            const value = normalized_scores[i];
            const percentage = (Math.abs(value)*100).toFixed(0) + '%'
            const agreement = value >= 0 ? "agreement" : "disagreement";

            markup += `
                <div class="row persometer-breakdown-row">
                    <div class="col-md-2 persometer-breakdown-persona">${PERSONAS[i].name}</div>
                    <div class="col-md-4 persometer-breakdown-text">${percentage} ${agreement}</div>
                    <div class="col-md-6 persometer-breakdown-meter">${score_meter_markup(value)}</div>
                </div>
            `;
        }
        markup += '</table>'
        $(container).append(markup);
    };

    /**
     * Renders a visual meter that is filled up based on the given value.
     * @param {number} value from -1 to 1
     */
    const score_meter_markup = value => {

        // Not very accessible since this is pure CSS, no readable text yet
        const empty_left = `<span style="display: inline-block; height: 100%; width: calc(50% - 1px); margin: 0; background-color: lightgrey; border-right: 1px solid black"></span>`;
        const empty_right = `<span style="display: inline-block; height: 100%; width: 50%; margin: 0; background-color: lightgrey;"></span>`;
        const remaining = `<span style="display: inline-block; height: 100%; background-color: lightgrey; width: ${50 - Math.abs(value)*50}%; margin: 0;"></span>`;

        let meter = "";
        if (value > 0) {
            const score = `<span style="display: inline-block; height: 100%; background-color: var(--green, green); width: ${Math.abs(value)*50}%; margin: 0;"></span>`;
            meter = `${empty_left}${score}${remaining}`;
        } else if (value < 0) {
            const score = `<span style="display: inline-block; height: 100%; background-color: var(--red, red); width: calc(${Math.abs(value)*50}% - 1px); border-right: 1px solid black; margin: 0;"></span>`;
            meter = `${remaining}${score}${empty_right}`;
        } else {
            meter = `${empty_left}${remaining}`;
        }

        return `
            <span style="height: 80%; width: 100%; display: inline-block">${meter}</span>
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
