---
title: Some Thoughts on Potential Functions and Latent-Space Topology
summary: Starting from iterated encoding and decoding, distinguish local rotation from global topological obstructions and examine what potentials, universal covers and Hodge decomposition can explain.
publishedAt: "2026-08-31T14:04:43Z"
updatedAt: "2026-10-30T14:34:14Z"
language: en
translationKey: potential-functions-latent-topology
routeSlug: potential-functions-latent-topology
category: inspirations
keywords:
  - latent dynamics
  - potential functions
  - universal cover
  - Hodge decomposition
  - attractors
draft: false
featured: true
comments: true
cover: /uploads/blogs/potential-functions-latent-topology/cover.png
coverAlt: The original researcher and star cat examine a loop around a punctured disk and its lifted helical path beside a separate circulating-flow model.
order: 700
---

A potential function offers an appealing language. If complex changes can be drawn as a landscape, perhaps valleys, slopes and attractors can explain what a model is doing. I am increasingly interested in where that landscape comes from—and when no globally consistent landscape exists.

[Work on the latent dynamics of neural models](https://arxiv.org/abs/2505.22785v4), based on repeated encoding and decoding, provided a starting point. The question here is how states evolve, not the probability-distribution question discussed in my separate essay on [sampling and energy-based views](/en/blogs/llm-sampling-energy-view/).

## Define the iteration first

For an encoder and decoder, consider

$$
F(z)=E_{\mathrm{enc}}(D(z)),\qquad v(z)=F(z)-z.
$$

We can then study $z_{t+1}=F(z_t)$. Fixed points and trajectories belong to this particular map. Changing the model, normalization, input representation or iteration rule can change the object of study.

For a language model, repeatedly feeding hidden representations through a selected module is an artificial probing experiment, not automatically its native autoregressive generation process. Shrinking differences between iterates do not establish improving semantics, convergence from every initialization or verified dynamical stability.

## When is there a potential?

If a continuous approximation satisfies $v=-\nabla E$ under a specified metric, then its continuous trajectories obey

$$
\frac{d}{dt}E(z(t))=-\|\nabla E(z(t))\|^2.
$$

That requires gradient structure; it is not a property of every network. Even a gradient-form discrete iteration needs step-size and stability checks before energy descent can be claimed.

Differential forms help separate the obstructions. Let the state space be a smooth Riemannian manifold $M$, and write $\alpha=v^\flat$. A global potential requires

$$
\alpha=-dE\ \Longrightarrow\ d\alpha=0.
$$

The converse need not hold on a general space. Local closedness and global exactness are different requirements. A field may already have local rotation, or it may be locally rotation-free while topology prevents a single-valued global potential.

## What can a universal cover change?

On the punctured plane, consider

$$
\alpha=\frac{-y\,dx+x\,dy}{x^2+y^2},
\qquad
\oint_{S^1}\alpha=2\pi.
$$

This form is closed but not globally exact. Unwrapping angle on the universal cover records winding continuously instead of only modulo $2\pi$. The pulled-back form becomes $d\theta$; with the negative-gradient convention above, a potential is $\widetilde E=-\theta$.

This resolves one kind of global obstruction, not every form of nonconservativity. For a covering map $p:\widetilde M\to M$,

$$
d(p^*\alpha)=p^*(d\alpha).
$$

A covering map is locally a diffeomorphism. Nonzero local rotation therefore cannot disappear merely by lifting. For example, on the plane,

$$
\alpha_0=-y\,dx+x\,dy,\qquad
d\alpha_0=2\,dx\wedge dy\ne0.
$$

That is a different obstruction from the angular example. Calling both fields nonconservative does not make them solvable by the same topological operation.

These statements concern smooth one-forms and the usual smooth universal cover. Simple connectedness helps with exactness of closed one-forms; it does not make closed forms of every degree exact.

## Decompose before interpreting

On a compact, oriented, smooth Riemannian manifold without boundary, Hodge decomposition gives a standard framework:

$$
\alpha=d\phi+\delta\psi+h,\qquad \Delta h=0.
$$

The components are exact, coexact and harmonic. [Tong's lecture notes](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html) provide geometric background. Setting $E=-\phi$ expresses the gradient component in the negative-gradient convention; it does not remove the other components.

For an actual model, this is first an analytical framework to investigate. A sampled effective space can have boundaries, noise and incomplete coverage. Metrics and boundary conditions matter. A theorem on a closed manifold is not evidence that a particular hidden-state point cloud satisfies its assumptions.

The ambient hidden-state space is usually Euclidean. Any relevant “holes” may belong to effective structure formed by data, rather than following from dimensionality alone. Their stability needs checking across samples, scales and perturbations.

## A more cautious research entry point

I would first pursue an operational diagnostic, not claim a new algorithm for improving language-model capability. With a fixed model and iteration definition, record trajectories from different initial distributions and examine endpoints, residuals, circulation and perturbation response.

In selected Euclidean coordinates, the antisymmetric part of a Jacobian can indicate local nongradient behavior. Loop integrals and structures stable across scales may help investigate more global obstructions. Estimation error, coordinate choices and dimensionality reduction need explicit controls.

Only then should we ask whether these quantities have stable relationships with memory, generalization or unusual trajectories on held-out tests—and whether they add value beyond simple distances, residuals and confidence baselines. These remain research questions, not diagnostic abilities I have demonstrated.

Topology supplies a reminder I find useful: two paths can arrive nearby without sharing the same history. Turning that reminder into a useful model diagnostic requires establishing whether the observed patterns are structure, or shadows cast by representation and measurement.

## References

- Marco Fumero et al., [Navigating Latent Space Dynamics, v4](https://arxiv.org/abs/2505.22785v4).
- David Tong, [Introducing Riemannian Geometry](https://www.damtp.cam.ac.uk/user/tong/gr/grhtml/S3.html).
- Vladimir G. Ivancevic and Tijana T. Ivancevic, [Undergraduate Lecture Notes in De Rham-Hodge Theory](https://arxiv.org/abs/0807.4991).
