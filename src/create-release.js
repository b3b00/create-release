const core = require('@actions/core');
const { GitHub, context } = require('@actions/github');
const fs = require('fs');

async function run() {
  let failsOnCreationError = true;
  try {
    // Get authenticated GitHub client (Ocktokit): https://github.com/actions/toolkit/tree/master/packages/github#usage
    const github = new GitHub(process.env.GITHUB_TOKEN);

    // Get owner and repo from context of payload that triggered the action
    const { owner: currentOwner, repo: currentRepo } = context.repo;

    console.log(`current owner = ${context.repo.owner}`);
    console.log(`current repo = ${context.repo.repo}`);

    // Get the inputs from the workflow file: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    const tagName = core.getInput('tag_name', { required: true });

    // This removes the 'refs/tags' portion of the string, i.e. from 'refs/tags/v1.10.15' to 'v1.10.15'
    const tag = tagName.replace('refs/tags/', '');
    const releaseName = core.getInput('release_name', { required: false }).replace('refs/tags/', '');
    const body = core.getInput('body', { required: false });
    const draft = core.getInput('draft', { required: false }) === 'true';
    const prerelease = core.getInput('prerelease', { required: false }) === 'true';
    const commitish = core.getInput('commitish', { required: false }) || context.sha;

    const bodyPath = core.getInput('body_path', { required: false });
    const owner = core.getInput('owner', { required: false }) || currentOwner;
    console.log(`owner :: ${owner} // current ${currentOwner}`);
    const repo = core.getInput('repo', { required: false }) || currentRepo;
    console.log(`repo :: ${owner} // current ${currentRepo}`);
    failsOnCreationError = core.getInput('failsOnCreationError', { required: false }) === 'true' || true;
    let bodyFileContent = null;

    /*
    check if release does not already exist. Returns immediatly if release exists.
    */
    const lastRelease = await github.repos.getLatestRelease({
      owner: currentOwner,
      repo: currentRepo
    });
    console.log('last release', lastRelease);
    console.log(`tag:>${tag}< lastestRelease.Tag:>${lastRelease.data.tag_name}<`);
    const lastTagName = lastRelease.data.tag_name;
    console.log(`comparing last release tag >${lastTagName}< to >${tag}<`);
    if (lastTagName === tag) {
      console.log('no need for new release');
      return;
    }

    if (bodyPath !== '' && !!bodyPath) {
      try {
        bodyFileContent = fs.readFileSync(bodyPath, { encoding: 'utf8' });
      } catch (error) {
        core.setFailed(error.message);
      }
    }

    console.log(`creating a new release with ${owner}/${repo} @${tag}`);
    // Create a release
    // API Documentation: https://developer.github.com/v3/repos/releases/#create-a-release
    // Octokit Documentation: https://octokit.github.io/rest.js/#octokit-routes-repos-create-release
    const createReleaseResponse = await github.repos.createRelease({
      owner,
      repo,
      tag_name: tag,
      name: releaseName,
      body: bodyFileContent || body,
      draft,
      prerelease,
      target_commitish: commitish
    });

    // Get the ID, html_url, and upload URL for the created Release from the response
    const {
      data: { id: releaseId, html_url: htmlUrl, upload_url: uploadUrl }
    } = createReleaseResponse;

    // Set the output variables for use by other actions: https://github.com/actions/toolkit/tree/master/packages/core#inputsoutputs
    core.setOutput('id', releaseId);
    core.setOutput('html_url', htmlUrl);
    core.setOutput('upload_url', uploadUrl);
  } catch (error) {
    if (failsOnCreationError) {
      core.setFailed(error.message);
    }
    core.setOutput('upload_url', '');
  }
}

module.exports = run;
