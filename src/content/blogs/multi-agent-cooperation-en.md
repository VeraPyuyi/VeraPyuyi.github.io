---
title: "How Multi-Agent Cooperation Emerges: From Game Theory to Concept Learning and Population Dynamics"
summary: Prisoner's Dilemma, concept distillation, and social learning offer a starting point for understanding how partner selection, networks, and exploration shape cooperation.
publishedAt: "2026-11-13T09:26:28Z"
language: en
translationKey: multi-agent-cooperation
routeSlug: multi-agent-cooperation
category: learning
keywords:
  - multi-agent systems
  - game theory
  - concept distillation
  - cooperation
  - population dynamics
draft: false
featured: false
comments: true
cover: /uploads/blogs/multi-agent-cooperation/cover.png
coverAlt: A researcher with long blue and pink hair and a star cat watch four small robots work together to repair a bridge in a model network.
order: 0
---

**When several participants pursue their own goals, influence one another, and can learn over time, why does cooperation sometimes emerge and sometimes break down or create new collective risks?**

An agent here is any participant that observes its environment and chooses an action. It might be a person, a robot, a program following fixed rules, or an AI system that adapts its behavior. A multi-agent system arises when several such participants share an environment and one agent's choices affect another's payoffs or circumstances. Robots working on a joint task and AI assistants allocating shared resources both have to reconcile individual objectives with collective outcomes. Learning is optional.

I am interested in how learning, imitation, partner selection, and communication change those interactions. Three perspectives help. **Game theory** explains the choices available under given rules. **Concept learning and social learning** examine how models acquire representations, behaviors, and norms. **Population dynamics** tracks where the system goes as many agents repeatedly adjust their strategies. Each perspective answers a different question about incentives, learning, or long-term evolution.

## Game theory: incentives, coordination, and commitment

When a payoff depends on what others do, optimizing your own objective can lead to a disappointing outcome for everyone. In an ordinary optimization problem, a decision-maker chooses variables to maximize an objective function. In a game, player $i$ chooses an action $a_i$ and receives $u_i(a_i,a_{-i})$, where $a_{-i}$ denotes the others' choices and $u_i$ assigns a numerical value to the outcome for player $i$. Each player has to reason about the others, who are reasoning in turn. For AI, this means that putting separately trained agents together can reveal problems that never arise in single-agent training.

The Prisoner's Dilemma offers a simple example. Players A and B can each cooperate $C$ or defect $D$. The first number in each cell is A's payoff and the second is B's.

| A's choice / B's choice | B cooperates $C$ | B defects $D$ |
| --- | ---: | ---: |
| A cooperates $C$ | $3,3$ | $0,5$ |
| A defects $D$ | $5,0$ | $1,1$ |

If B cooperates, A gets 5 by defecting and 3 by cooperating. If B defects, A gets 1 by defecting and 0 by cooperating. Defection pays A more in either case, making it a **strictly dominant strategy**. B has the same incentives, so both defect and receive 1 each. Mutual cooperation would have paid them 3 each.

**Pursuing a local interest can leave every participant worse off.**

A Nash equilibrium describes a situation in which no player can improve their own payoff by changing their strategy alone. For a candidate pure-strategy equilibrium, mark the actions with asterisks:

$$
u_i(a_i^*,a_{-i}^*)\geq u_i(a_i,a_{-i}^*)
$$

The inequality must hold for every player $i$ and every alternative action $a_i$. The left side is the equilibrium payoff, and the right side is the payoff after a unilateral deviation. Mutual defection is a Nash equilibrium in the Prisoner's Dilemma because cooperating alone against a defector reduces the payoff from 1 to 0. A Nash equilibrium can still be unfair or leave total payoffs below their attainable maximum.

A **Pareto improvement** makes at least one player better off without making anyone worse off. Moving from mutual defection to mutual cooperation raises both payoffs from 1 to 3. Mutual defection is therefore not Pareto efficient.

Cooperation can also fail because of uncertainty about a partner. In the Stag Hunt, two players who hunt stag together receive 4 each, and two who hunt hare separately receive 2 each. If one hunts stag while the other hunts hare, the stag hunter gets 0 and the hare hunter gets 3. Mutual stag hunting and mutual hare hunting are both Nash equilibria. The best response to a partner known to hunt stag is to hunt stag, and the best response to a partner known to hunt hare is to hunt hare. The difficulty is knowing how much to trust the partner.

If the other player hunts stag with probability $p$, the expected payoffs are

$$
U(\text{hunt stag})=4p,\qquad
U(\text{hunt hare})=3p+2(1-p)=2+p.
$$

Stag is the better choice only when $p>2/3$. The two actions pay equally at $p=2/3$. Players can agree that hunting stag together is better and still end up hunting hare because their confidence in one another falls below that threshold. Once both are hunting stag, neither gains from switching alone. In the Prisoner's Dilemma, a cooperating partner still gives the other player an incentive to defect.

The game of Chicken introduces a conflict over who yields. Imagine two cars approaching each other. If both swerve, they receive 2 each. If one goes straight while the other swerves, the driver who goes straight receives 3 and the other receives 1. If both go straight, they crash and receive 0 each. In each pure-strategy equilibrium, one goes straight and the other swerves. Both prefer to be the driver who receives 3.

A pure strategy selects an action with certainty. The pure equilibria so far illustrate three distinct obstacles: private incentives can conflict with shared interests, players can lack confidence in their partners, and each player may want the other to bear the cost of yielding. Diagnosing the structure helps decide whether to change payoffs, build trust, or adjust the coordination rules.

A mixed strategy assigns probabilities to actions. If the other driver in Chicken swerves with probability $q$, swerving yields an expected payoff of $2q+1(1-q)=1+q$, and going straight yields $3q$. To mix between both actions at equilibrium, a player must be indifferent between them. Equating the payoffs gives $q=1/2$. In the symmetric mixed equilibrium, each driver independently swerves with probability one half. Each expects $3/2$, and they still crash with probability $1/4$. Equilibrium can carry substantial risk. Randomization can also be strategically useful in settings where predictability gives an opponent an advantage.

Nash's existence theorem guarantees an equilibrium in mixed strategies for any finite game. A pure strategy is a special case that puts all probability on one action. When several equilibria exist, the theorem leaves open which one a learning process will select. Population dynamics will return to that question.

Commitment changes the decision a player faces. Suppose A in Chicken can publicly and irrevocably commit to going straight and B believes the commitment. B's best response becomes swerving, and A can receive 3. If both can make such commitments, the outcome depends on the rules of the commitment stage.

### Program games

In the usual Prisoner's Dilemma, players submit actions. A program game lets each player submit a program that can read the other program before choosing to cooperate or defect. CliqueBot cooperates with identical code and defects otherwise. Two CliqueBots cooperate. If one player switches to a different program, the remaining CliqueBot defects, so the deviator cannot get the high payoff from defecting against cooperation. The programs have access to information the original one-shot game does not provide.

CliqueBot depends on the literal form of the code. Even programs with identical behavior can fail to cooperate if they are written differently. FairBot instead cooperates if it can prove the other program will cooperate with it. The guarantee depends on the soundness of the proof system, the accuracy of the program descriptions, and the match between the verified program and what actually runs.

GroundedFairBot, abbreviated $G$, cooperates directly with a small probability $\varepsilon$. Otherwise, it simulates how its opponent would treat it and copies the resulting action. When $G$ plays itself, calls can recurse. Every level has probability $\varepsilon$ of stopping and returning cooperation, which then propagates back through the calls. For $\varepsilon>0$, the call chain terminates almost surely and both cooperate. To decide whether this is a program equilibrium, specify which deviations are allowed. Start with both players running $G$ and let one replace it with a program $Q$ that almost surely terminates and returns an action. Each call draws fresh independent randomness, so the actual $Q(G)$ is independent of the simulated $Q(G)$. If $q$ is the probability that $Q$ cooperates with $G$, then $G$ cooperates with $Q$ with probability $p=\varepsilon+(1-\varepsilon)q$. Using the earlier payoffs, the deviator's expected payoff is

$$
f(q)=3pq+5p(1-q)+(1-p)(1-q)
=1+4\varepsilon+(3-5\varepsilon)q-(1-\varepsilon)q^2.
$$

Comparing this quadratic with the mutual-cooperation payoff of 3 gives an exact bound under these independence and program assumptions. No allowed randomized deviation pays more precisely when $0<\varepsilon\leq1/3$. Checking unconditional defection alone, at $q=0$, gives the weaker condition $\varepsilon\leq1/2$ and misses other profitable randomized deviations. Testing a few obvious bad strategies does not establish stability against the entire deviation class. A smaller $\varepsilon$ also lengthens the expected call chain in self-play, and almost-sure termination gives no fixed worst-case runtime bound.

Game theory separates questions about incentives, information, and commitment. In practical AI systems, agents may only partly understand one another's policies. Learning algorithms, limited computation, and uncertainty then affect whether an agent can establish credible cooperation and which equilibrium the system selects.

## Concept learning, social learning, and cooperation norms

This section looks at how models learn concepts people can describe, how they learn from other actors, and how prosocial behavior can develop. The concept-learning examples concern neural network training. The social examples come from work on cultural evolution, norms, and interacting language models. In each case, the question is how a learned capability carries over to a new situation or a group interaction.

A model can give a correct answer for a fragile reason. If every zero in a training set is red, a classifier can learn that **red means zero**. It can score well in training and fail when a zero turns purple. Interpretability can help identify the feature on which the model relies and suggest how to intervene.

A **Concept Activation Vector**, or CAV, represents a human-described concept in a network's activation space. Let $\xi$ be an input image and $h(\xi)$ its representation at a chosen layer. Collect examples of a concept such as stripes, and a comparison set. Pass both through the network and train a linear classifier to separate their representations. The normalized normal to its separating hyperplane, $v_{\mathcal C}$, represents concept $\mathcal C$ at that layer. This gives stripes, color, or texture a direction along which model sensitivity can be measured.

If $g_k(h)$ is the output score for class $k$, the sensitivity is

$$
S_{\mathcal C}(\xi)=\nabla_h g_k(h(\xi))^\top v_{\mathcal C}
$$

It measures the first-order change in the score when the internal representation moves slightly in the concept direction. The gradient $\nabla_h g_k$ describes the score's response to each component of the representation. Taking its inner product with the concept direction gives a directional derivative. **Testing with Concept Activation Vectors** (TCAV) aggregates such sensitivities across examples. **Concept Distillation** turns concept sensitivity into a training constraint. If $L_0$ is the original task loss and $L_C$ is a concept loss, the objective becomes

$$
L=L_0+\lambda L_C.
$$

The weight $\lambda\geq0$ controls how strongly the concept constraint affects training. To reduce reliance on a concept, the concept loss uses the absolute cosine of the angle between the constrained loss gradient and the CAV. Minimizing it encourages perpendicularity, so a small change along the concept direction has little first-order effect on that loss. The absolute value matters because strong sensitivity in the opposite direction would still be dependence on the concept.

Prototypes provide a second training signal. Cluster representations of samples from the same class at an intermediate layer, select representative points, and construct an intermediate loss $L_p$ from distances to those points. TCAV can already examine concepts at intermediate layers. Prototypes provide training targets at such layers, whose gradients can then be used to constrain concept sensitivity.

A teacher model supplies concept representations when the student's own activation space may already reflect the bias being addressed. The method uses a strong pretrained vision model and learns a mapping between the teacher's and student's representation spaces so those concepts can guide the student.

Concept methods have other uses. In intrinsic image decomposition, the image is approximated as the element-wise product of reflectance $R$ and shading $S$, written $I=R\odot S$. The symbol $\odot$ denotes multiplication at corresponding positions. Object color should appear mainly in $R$ and illumination changes in $S$. Concept sensitivity gives a way to check and constrain this division. In backdoor defense, a trigger pattern can make inputs from different classes produce an attacker-selected prediction. Prototype-guided fine-tuning uses the geometry of the activation space to reduce that dependence.

Concept examples can be impure. A stripe direction may pick up color or shape. A single linear direction can miss aspects of a complex concept, and a small local gradient leaves open what happens under larger changes. A teacher can bring its own biases, and a student can switch to a proxy after one measurable direction is suppressed. More reliable interpretation requires checking the stability of concept definitions, testing whether interventions affect the intended mechanism, and measuring whether effects hold across models and environments.

**Interpretability can suggest a testable intervention and a prediction about how the model will respond.**

### Imitation, reciprocity, and social norms

Social learning asks how an agent acquires a capability from others' behavior. In imitation learning, an agent learns actions from expert demonstrations. Policy distillation brings the student's distribution over actions closer to the teacher's, for example by minimizing

$$
D_{\mathrm{KL}}\!\left(\pi_T(\cdot\mid s)\,\|\,\pi_S(\cdot\mid s)\right).
$$

Here $s$ is the current situation, $\pi_T$ and $\pi_S$ are the teacher's and student's distributions over actions in that situation, and $D_{\mathrm{KL}}$ is the $KL$ divergence. If the expert nearly always chooses a particular action in a situation, the student learns to favor it as well. This saves agents some trial and error. It can also transmit bad policies, biases, or short-term opportunism, so the choice of whom to imitate and how to measure success matters.

Reciprocity can change incentives when the same players meet repeatedly. Use the earlier Prisoner's Dilemma payoffs and suppose a pair interacts indefinitely, past actions are perfectly observable, and future payoffs are discounted by $0\leq\delta<1$. Larger $\delta$ gives more weight to the future. Under a grim-trigger strategy, each cooperates until a defection occurs and defects forever afterward. Continued cooperation has value $3/(1-\delta)$. Defecting once in the cooperative phase and then receiving the mutual-defection payoff has value $5+\delta/(1-\delta)$. Cooperation withstands this deviation when $\delta\geq1/2$. Mutual defection is itself a stage-game Nash equilibrium, which gives each player an incentive to carry out the punishment once it begins.

This calculation assumes indefinite or otherwise sustained interaction, observable actions, and credible future behavior. When the end date is fixed and common knowledge, backward induction under the standard complete-information and rationality assumptions gives defection in the last round and in each preceding round.

Direct reciprocity rewards someone who previously helped you. Indirect reciprocity rewards someone who helped others. Network reciprocity allows cooperators to support one another locally. Group selection asks whether groups with greater cooperation are more likely to preserve and spread their behavior. Kin selection is another mechanism relevant to biological cooperation and concerns the evolutionary effects of helping genetic relatives.

In a donor game, one agent spends $d$ units of resources and another receives $2d$. Total resources increase, but the donor pays an immediate cost and agents who never donate can free-ride. In the 2024 study *Cultural Evolution of Cooperation among LLM Agents*, agents observe others' recent actions and transmit successful policies as text to later generations. Under the reported setup, groups using Claude 3.5 Sonnet were better able to sustain cooperation than groups using Gemini 1.5 Flash or GPT-4o. Outcomes varied with the initial strategies and between runs. The generations primarily inherited behavioral guidance and experience as text. Prompt transmission can account for changes in behavior without any update to the underlying model weights. Evidence that the parameters had acquired a new moral capability would require a separate test. Ablations can help separate the effects of pretrained knowledge, prompts, memory, and selection on how cooperation generalizes.

*Group Selection Promotes Prosocial Prompts in Populations of LLM Agents* varied how policies were selected for transmission. In its simulations, selection based on group payoffs helped spread prosocial prompts and sustain cooperation. Selection based on individual payoffs more often favored self-interested strategies. The result depends on which experiences the system treats as successful enough to copy. *Cooperate or Collapse: Emergence of Sustainable Cooperation in a Society of LLM Agents* studies a related problem using a shared resource that regenerates but can be depleted. Each agent can benefit by taking more, while excessive extraction can end the simulation. The authors developed GovSim and found that communication and reasoning about long-term consequences mattered for cooperation. Across their reported benchmark settings, the best overall survival rate remained below 54%. Survival refers to whether the simulated society persists under its resource constraints. Prompting agents to ask what would happen if everyone acted the same way offered a way to improve sustainability.

Social norms are shared expectations about how to act in a situation. The **logic of appropriateness** describes behavior guided by questions about the situation, one's role, and what is expected of someone in that role. Norms can be learned and transmitted as patterns for particular contexts. An LLM's exposure to cultural texts may supply some of the patterns behind its norm-following behavior.

Generative agent modeling tools such as Concordia let researchers study roles, memories, environments, and action outcomes over ongoing interactions. One question is whether training a single model to exhibit honesty or humility improves behavior in a multi-agent system. Three levels need separate tests: what values a model can articulate, how an individual model behaves in a test, and what behavior a group of models maintains over repeated interactions. A cooperative group can also exclude outsiders, coordinate to mislead an overseer, or compete over resources.

## Population dynamics

Two studies follow longer-term change directly. One looks at cooperation among policy-gradient learners that select partners. The other asks how imitation on a rapidly changing network leads to consensus or a stationary distribution.

A model must specify how agents act and learn, how rewards are computed, who interacts with whom, and what constraints the environment imposes. Here, agent behavior is represented by a cooperation probability $x_i\in[0,1]$. At $x_i=0.8$, the agent cooperates with probability 80% on each action. In the donation game used for the analysis, cooperation gives a partner benefit $b$ and costs the cooperator $c$, where $b>c>0$. The focal player's payoffs for mutual cooperation, cooperating against a defector, defecting against a cooperator, and mutual defection are $b-c,-c,b,0$, respectively. The game has the Prisoner's Dilemma structure. Adding the constant $c$ to all four payoffs gives the equivalent representation $b,0,b+c,c$.

Let $z$ be the fraction of a population playing the cooperative strategy, and let $f_C$ and $f_D$ be the mean payoffs of cooperators and defectors. The replicator equation is

$$
\dot z=z(1-z)(f_C-f_D).
$$

Here $\dot z$ is the rate of change in $z$. A positive value means the share of cooperators grows. A negative value means it falls. The model represents evolution or imitation by letting **higher-paying strategies spread**. With random matching in the donation game, cooperation costs an extra $c$ compared with defection, so $f_C-f_D=-c$. The equation becomes

$$
\dot z=-cz(1-z).
$$

Starting at any interior share $0<z<1$, cooperation gradually disappears. If the interaction rules give cooperators no way to recoup the benefits they create, copying successful strategies alone does not resolve the dilemma.

The same equation explains why equilibria can behave differently across games. In the Stag Hunt, take $z$ as the share hunting stag. Under random matching, stag yields $4z$ and hare yields $2+z$, giving

$$
\dot z=z(1-z)(3z-2).
$$

The interior point $z=2/3$ is unstable. Slightly above it, the share hunting stag rises. Slightly below it, the share falls.

In Chicken, let $z$ be the share choosing to swerve. The payoff difference between swerving and going straight is $1-2z$, so

$$
\dot z=z(1-z)(1-2z).
$$

The interior point $z=1/2$ is stable. Below it, the share swerving rises. Above it, the share falls. Both games have interior mixed Nash equilibria, yet their dynamics differ in whether nearby states approach or move away from the equilibrium. The replicator equation can also stop at an endpoint after a strategy disappears, because the model contains no mutation to reintroduce it.

### Policy gradients and partner selection

In the partner-selection study, each agent has two action scores $\psi_C,\psi_D$. A softmax converts them into a probability of cooperation:

$$
x=\frac{e^{\psi_C}}{e^{\psi_C}+e^{\psi_D}},
$$

Let $H$ be the number of interaction rounds before a parameter update. During these $H$ rounds, an agent acts with a fixed policy, collects rewards, and updates only after the interaction ends. The distribution of others' policies is likewise treated as fixed during this short interaction. Individual policies and their population distribution evolve across successive updates.

Averaging the stochastic updates and approximating them in continuous time gives

$$
\dot x
=
2\alpha x^2(1-x)^2\Delta G,
$$

where $\alpha>0$ is the learning rate and $\Delta G$ summarizes how each action affects subsequent payoffs. Let $R_h$ denote the remaining total return from round $h$ through the end of the interaction. Then

$$
\Delta G=\sum_{h=1}^{H}
\left[\mathbb E(R_h\mid a_h=C)-\mathbb E(R_h\mid a_h=D)\right].
$$

In each round, this compares the expected remaining return from cooperating with that from defecting while leaving the subsequent decision rules fixed. The differences are summed across rounds. For a learner at $0<x<1$, the factor $2\alpha x^2(1-x)^2$ is positive, so the sign of $\Delta G$ determines whether cooperation becomes more or less likely.

Here $x$ describes an individual learner's probability of cooperation, whereas $z$ in the replicator model describes a population share using a pure strategy. Both models can tend toward defection at different rates. If partners are redrawn randomly in each round and there are two rounds before an update, $\Delta G=-2c$, hence

$$
\dot x=-4\alpha c x^2(1-x)^2.
$$

Near zero, the individual cooperation probability decays approximately as $1/t$, while the population share in the replicator model decays exponentially. The softmax becomes less sensitive to changes in the action scores as one action becomes nearly certain, slowing learning.

Out-for-Tat changes who meets in the next round. A pair stays together if both cooperated this round. Otherwise, each draws a new partner from the population. Tit-for-Tat uses the opponent's previous action to choose the next action. Under Out-for-Tat, an agent can still use a cooperation probability that depends on neither history nor partner identity. The matching rule carries information from the previous round. Frequent cooperators get more chances to retain other frequent cooperators, and a defector loses the current match.

The value of partner selection can be calculated in a two-round model. Assume each agent's cooperation probability is fixed across the two rounds, actions are sampled independently conditional on those probabilities, initial and replacement partners are drawn independently from the same fixed population distribution $\rho$, and second-round payoffs are undiscounted.

Let $Y$ be a randomly drawn partner's cooperation probability and $m=\mathbb E[Y]$ its population mean. Defecting in round one guarantees a new draw, so the expected cooperation probability of the next partner is $m$. If you cooperate in round one, the initial partner, whose cooperation probability is $Y$, cooperates and stays with probability $Y$. Otherwise, you receive a new draw. The next partner's expected cooperation probability is therefore $\mathbb E[Y^2+(1-Y)m]$. Subtracting $m$ gives

$$
\mathbb E[Y^2]-\mathbb E[Y]^2
=
\operatorname{Var}_\rho(Y).
$$

This is the variance in cooperation probabilities. Compared with defecting in round one, cooperating immediately costs an additional $c$ but improves expected second-round payoffs by $b\operatorname{Var}_\rho(Y)$ through partner selection. There is no later interaction after round two, so cooperating in that round changes payoffs by $-c$. Summing the two remaining-return differences gives

$$
\Delta G=b\,\operatorname{Var}_\rho(Y)-2c.
$$

The term $b\operatorname{Var}_\rho(Y)$ is the future benefit of retaining better partners. The term $2c$ counts the cooperation cost in each round. When the first exceeds the second, the learning update favors cooperation. Imagine two populations with a mean cooperation probability of 50%. In one, every agent has a 50% probability of cooperating, so a new partner is as good as the old one. In the other, some agents cooperate often and others rarely do. Retaining a reliable partner is valuable there. Populations with the same mean can therefore exert different pressures on learning.

Because $Y\in[0,1]$, its variance is at most $1/4$. For any population distribution to give $\Delta G>0$, the parameters must satisfy $b>8c$. With cooperation probabilities initially uniform on $[0,1]$, the variance is $1/12$, and an initially positive learning signal requires $b>24c$.

The variance can change as the population learns. Furthermore, an individual exactly at $x=0$ or $x=1$ does not move under the equation because the prefactor vanishes. The distribution with half the agents at 0 and half at 1 attains the maximum variance $1/4$, even though the exact endpoint strategies have zero policy-gradient flow.

Tracking many individual trajectories $x_i(t)$ becomes expensive. A population description tracks the distribution of cooperation probabilities instead. Let $\rho(t,x)$ be its density at continuous learning time $t$. Then

$$
\int_{0.7}^{0.8}\rho(t,x)\,dx
$$

is the fraction of agents with cooperation probabilities between 0.7 and 0.8. Averaged learning moves probability mass along the velocity field $v[\rho](x)$, giving the transport equation

$$
\partial_t\rho+\partial_x\!\left(\rho\,v[\rho]\right)=0.
$$

The derivative $\partial_t$ describes change over time and $\partial_x$ describes change along the probability axis. The flux $\rho\,v[\rho]$ measures the movement of probability mass. Individual preferences change while the total mass stays at 1. The velocity field depends on the population because who gets matched and how cooperation affects future rewards depend on the other agents.

Sample-based policy-gradient updates also fluctuate. Two agents with identical initial parameters can diverge after meeting different partners and receiving different returns. The study uses stochastic differential equations and Fokker–Planck equations to describe average motion and random diffusion. This matters because variation within the group affects the value of partner selection. Under the reported simulation parameters, retaining cooperating partners produced a substantial group near the cooperative end, whereas continual rematching more readily led to defection.

### Changing networks, imitation, and exploration

The second study extends pairwise interactions to an evolving network. Each agent can be connected to multiple neighbors, with connection weight $a_{ij}$. Agents are more inclined to imitate neighbors with higher payoffs. The model represents this inclination using a logistic Fermi function:

$$
p_{ij}=
\frac{1}{1+\exp[-\beta(r_j-r_i)]}.
$$

Here $r_i$ is the current payoff to agent $i$, $p_{ij}$ is the propensity for $i$ to learn from neighbor $j$ in a comparison, and $\beta\geq0$ controls sensitivity to the payoff gap. At $\beta=0$, payoff differences do not affect comparisons and $p_{ij}=1/2$. For an agent with total connection weight $k_i>0$, the cooperation probability changes according to

$$
\dot x_i=\frac{1}{k_i}\sum_j a_{ij}p_{ij}(x_j-x_i),
\qquad k_i=\sum_j a_{ij}.
$$

This sums the neighbors' influences. A stronger connection and a greater tendency to imitate a neighbor both make the neighbor's strategy pull more strongly on the agent's own. Dividing by $k_i$ normalizes the influences. More cooperative neighbors pull the probability upward, and less cooperative neighbors pull it downward. Payoff comparisons and network ties jointly shape the adjustment.

The network also changes. The study uses a rule under which a connection weight tends toward the mean of its endpoints' cooperation probabilities:

$$
\dot a_{ij}
=
\frac{1}{\tau}
\left(\frac{x_i+x_j}{2}-a_{ij}\right).
$$

The timescale $\tau>0$ controls how fast connections adapt to strategies. When it is much shorter than the timescale of strategy change, weights closely track their current target and can be approximated by $a_{ij}\approx(x_i+x_j)/2$. Two highly cooperative agents then have a strong connection, two agents with low cooperation probabilities have a weak connection, and a mixed pair lies between them. This rule allows analysis of who is likely to interact with whom, whose behavior is copied, and what that does to cooperation.

Without exploration noise, the individual dynamics yield a population transport equation. Under the specified fast-network model and its mean-field assumptions, the deterministic distribution converges to a Dirac mass $\delta_{x^*}$. Initially dispersed cooperation probabilities concentrate at a shared level $x^*$.

To study when this level is high, the researchers also consider an initial population with clusters of cooperators and defectors, reducing the population question to the motion of two clusters. Numerical results show that the eventual level depends on the benefit-to-cost ratio, initial composition, selection strength, and network mechanism. The model can also add random exploration explicitly. In the preceding study, fluctuations arise from learning on sampled returns. Here, ongoing exploration is part of the individual model. Write the density as $\mu(t,x)$. It plays the same role as $\rho$ but corresponds to a different learning rule. $V_\mu(x)$ is the average direction and speed of strategy change in a population with distribution $\mu$ for an agent with cooperation probability $x$. With individual exploration strength $\sigma$, the diffusion coefficient is $D=\sigma^2/2$ and the population equation is

$$
\partial_t\mu
=
-\partial_x(\mu V_\mu)
+
D\,\partial_{xx}\mu,
\qquad D=\frac{\sigma^2}{2},
$$

The drift $-\partial_x(\mu V_\mu)$ captures movement driven by imitation and network selection, while the diffusion term $D\partial_{xx}\mu$ captures the variation continually introduced by exploration. No-flux boundaries at $x=0$ and $x=1$ keep probability mass in the admissible interval. One can picture exploration reflecting at the endpoints. With flux $J=\mu V_\mu-D\partial_x\mu$, both boundaries satisfy $J=0$.

Without exploration, imitation can stop changing the population once strategies agree. Exploration keeps generating differences on which selection can act. The study uses a finite-volume method to approximate the density over time and examines three separate questions: whether stationary distributions exist, whether they are unique, and whether they recover from small perturbations. With exploration, a stationary distribution can coexist with individuals continually changing strategies, provided the net probability flux balances. Stationarity and the no-flux condition give

$$
D\,\mu'(x)=\mu(x)V_\mu(x).
$$

The difficulty is that the drift $V_\mu$ depends on the unknown distribution $\mu$.

This is a self-consistency problem. Start with a candidate distribution, calculate its interactions and drift, solve for a stationary distribution under that drift, and require that the result reproduce the candidate. Under the stated assumptions, Schauder's fixed-point theorem gives at least one self-consistent solution. With sufficiently strong exploration, the fixed-point map is a contraction and the solution is unique. Stability requires a separate argument. Perturb the steady state by moving a small amount of mass without changing the total, linearize to keep the first-order terms, and use an energy estimate to test whether the perturbation decays. This gives linear stability under suitable sufficient conditions.

Together, the two studies identify several ways that individual learning and collective behavior feed back on one another. Partner selection changes the distribution of future opponents. Network weights change who influences whom. Stochastic updates and exploration change the amount of variation in the population, which can change payoffs and the direction of learning. Both analyses depend on modeling choices, including one-dimensional cooperation probabilities, particular payoffs and partner-retention rules, fast-network approximations, and large-population descriptions. Language-model agents introduce additional variables, such as memory in language, judgments about identities, complex tasks, and higher-dimensional policies.

## Afterword

This has turned out a little theoretical. Two applications come to mind:

1. Study strategic interactions and attack–defense dynamics among agents in quantitative markets or decentralized environments.
2. Build a platform where agents from different vendors and base models work as peers. For example, I could ask them to modify a piece of software, and they would coordinate the changes among themselves, with equal standing and no designated lead agent receiving reports.

## References

- [Robust Cooperation in the Prisoner's Dilemma: Program Equilibrium via Provability Logic](https://arxiv.org/abs/1401.5577)
- [Robust program equilibrium](https://doi.org/10.1007/s11238-018-9679-3)
- [Interpretability Beyond Feature Attribution: Quantitative Testing with Concept Activation Vectors (TCAV)](https://proceedings.mlr.press/v80/kim18d.html)
- [Concept Distillation: Leveraging Human-Centered Explanations for Model Improvement](https://arxiv.org/abs/2311.15303)
- [Cultural Evolution of Cooperation among LLM Agents](https://arxiv.org/abs/2412.10270)
- [Group Selection Promotes Prosocial Prompts in Populations of LLM Agents](https://arxiv.org/abs/2606.23343)
- [Cooperate or Collapse: Emergence of Sustainable Cooperation in a Society of LLM Agents](https://arxiv.org/abs/2404.16698v3)
- [The Dynamics of Policy Gradient in Social Dilemmas with Partner Selection](https://arxiv.org/abs/2605.18185)
- [Mean-field imitation dynamics on fast assortative networks](https://arxiv.org/abs/2606.11892)
