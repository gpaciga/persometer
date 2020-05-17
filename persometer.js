const Persometer = config => {

    const CONTAINERID = config.container;
    const STATEMENTS = config.statements;
    const CATEGORIES = config.categories; // should rename this

    // todo: Myers-Briggs option: N "results" categories, +/- result determine each extreme, combine into 2^N types

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
            }
        ];
        tests.forEach(test => test());
    };

    const handle_submit = (form, event) => {
        event.preventDefault(); // dont refresh the page
        set_result_code($(form).serialize());
        render_result(CONTAINERID, $(form).serializeArray());
    };

    const get_answers_from_code = () => {
        const url = new URL(window.location.href);
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

    const set_result_code = value => {
        const url = new URL(window.location.href);
        url.searchParams.set("r", value);
        window.history.pushState(null, document.title, url.href);
    };

    const render_statements = (id) => {
        const div = document.getElementById(id);
        $(div).empty();
        const form = document.createElement("form");
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

    const render_result = (id, answers) => {
        const div = document.getElementById(id);
        $(div).empty();
        $(div).append('<strong>Result!</strong><br/>')
        scores = add_scores(answers);
        render_best_match(div, scores);
        render_scores(div, scores);

        const resetButton = document.createElement('input');
        resetButton.type = "button";
        resetButton.onclick = reset;
        resetButton.value = "Start over";
        $(div).append(resetButton);
    };

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

    const get_maximum_scores = () => {
        const maxima = new Array(CATEGORIES.length).fill(0);
        STATEMENTS.forEach(s => {
            for (i = 0; i < CATEGORIES.length; i++) {
                maxima[i] += Math.abs(s.scores[i])
            }
        });
        return maxima;
    };

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

    const get_best_result = scores => {
        // ignoring ties and using the first match
        const ibest = scores.indexOf(Math.max(...scores));
        return CATEGORIES[ibest];
    };

    const render_best_match = (container, scores) => {
        const match = get_best_result(scores);
        $(container).append('<p>Best match:</p>');
        $(container).append(`<p><strong>${match.name}</strong></p>`);
        $(container).append(`<p>${match.description}</p>`);
    };

    const render_scores = (container, scores) => {
        $(container).append('<p>Scores!</p>');
        const normalized_scores = normalize_results(scores);
        for (i = 0; i < CATEGORIES.length; i++) {
            const value = normalized_scores[i];
            $(container).append(`<p><strong>${CATEGORIES[i].name}</strong>: ${score_meter_markup(value)}</p>`);
        }
    };

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

    const render = () => {
        const answers = get_answers_from_code();
        if (answers) {
            render_result(CONTAINERID, answers);
        } else {
            render_statements(CONTAINERID);
        }
    };

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
