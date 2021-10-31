const axios = require('axios');
const { TRACKER_API, TRACKER_ID, GITHUB_API, REPOSITORY_URL } = require('./config.js');
const OAUTH = 'AQAAAAAAqu8IAAd44L0wFjF6Z00rm_33Yz7oltM';

const createReleaseTicket = async (id, summary, description) => {
    console.log([...arguments]);
    await axios({
        url: `${TRACKER_API}/v2/issues`,
        method: 'POST',
        data: {
            queue: 'TMP',
            summary,
            description,
            type: 'task',
            unique: id
        },
        headers: {
            Authorization: `OAuth ${OAUTH}`,
            'X-Org-Id': TRACKER_ID
        }
    })
    .catch(e => console.log(e));
}

const updateReleaseTicket = async (ticketId, summary, description) => {
    await axios({
        url: `${TRACKER_API}/v2/issues/${ticketId}`,
        method: 'PATCH',
        data: {
            queue: 'TMP',
            summary: summary,
            description: description,
            type: 'task'
        },
        headers: {
            Authorization: `OAuth ${OAUTH}`,
            'X-Org-Id': TRACKER_ID
        }
    })
    .catch(e => console.log(e));
}

const findTicket = async id => {
    let result = [];
    await axios({
        url: `${TRACKER_API}/v2/issues/_search`,
        method: 'POST',
        data: {
            filter: {
                queue: 'TMP',
                unique: id
            },
        },
        headers: {
            Authorization: `OAuth ${OAUTH}`,
            'X-Org-Id': TRACKER_ID
        }
    }).then(res => {
        result = res.data;
    })
    .catch(e => console.log(e));

    return result;
}

const getTagMeta = async url => {
    let result = {};

    await axios({
        method: 'GET',
        url
    })
        .then(response => {
            result = response.data.tagger;
        })
        .catch(e => console.log(e));

        return result;
}

const getTags = async () => {
    const tags = [];

    await axios({
        method: 'GET',
        url: `${GITHUB_API}/repos/${REPOSITORY_URL}/git/refs/tags`
    })
        .then(res => {
            tags.push(...res.data);
        })
        .catch(e => console.log(e));

    return tags.map(tag => {
        return {
            ref: tag.ref,
            ver: tag.ref.split('/')[2],
            url: tag.url,
            object: tag.object
        }
    }).sort();
}

const getTagsDiff = async (prevTag, lastTag) => {
    const result = [];

    await axios({
        method: 'GET',
        url: `${GITHUB_API}/repos/${REPOSITORY_URL}/compare/${prevTag}...${lastTag}`
    })
        .then(res => {
            result.push(...res.data.commits);
        })
        .catch(e => console.log(e));

    return result.map(commit => ({
        author: commit.commit.author,
        message: commit.commit.message,
        url: commit.html_url
    }));
}

const generateId = (prefix, tag) => `${prefix}/${tag}`;

const createReleaseNotes = (tagMeta, version, diff) => {
    var result = `Version: ${version}\nDate: ${tagMeta.date}\nAuthor: ${tagMeta.name}\n\nRELEASE NOTES:\n`;
    for (let commit of diff) {
        result += `[${commit.author.date}] ${commit.message}\n`;
    }
    return result;
}

const createRelease = async () => {
    const tags = await getTags();
    if (!tags || !tags.length) return;

    const lastTag = tags[tags.length - 1];
    const prevTag = tags.length < 2 ? lastTag : tags[tags.length - 2];
    const meta = await getTagMeta(lastTag.object.url);
    const diff = await getTagsDiff(prevTag.ref, lastTag.ref);

    const ticketId = generateId(REPOSITORY_URL, lastTag.ver);
    const tickets = await findTicket(ticketId);

    if (tickets.length) {
        updateReleaseTicket(tickets[0].id, `Release artifact ${lastTag.ver}`, createReleaseNotes(meta, lastTag.ver, diff));
    } else {
        createReleaseTicket(ticketId, `Release artifact ${lastTag.ver}`, createReleaseNotes(meta, lastTag.ver, diff));
    }
}

createRelease();