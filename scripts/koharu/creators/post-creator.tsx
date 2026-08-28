import { TextInput } from '@inkjs/ui';
import { Box, Text } from 'ink';
import { useCallback, useEffect, useState } from 'react';
import { ConfirmScreen, CreatingScreen, DoneScreen, ErrorScreen, CycleSelect as Select, StepItem } from '../components';
import { useStepFlow } from '../hooks';
import { createPost, generateSlug, postExists } from '../utils/new-operations';
import type { CreatorProps, PostData } from './types';

type Step = 'title' | 'slug' | 'description' | 'keywords' | 'draft' | 'confirm' | 'creating' | 'done' | 'error';

const INPUT_STEPS: Step[] = ['title', 'slug', 'description', 'keywords', 'draft'];
const STEP_CONFIGS: { id: Step; label: string }[] = [
  { id: 'title', label: '标题' },
  { id: 'slug', label: 'Slug' },
  { id: 'description', label: '描述' },
  { id: 'keywords', label: 'SEO 关键词' },
  { id: 'draft', label: '草稿' },
];

export function PostCreator({ onComplete, showReturnHint = false }: CreatorProps) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [autoSlug, setAutoSlug] = useState('');
  const [description, setDescription] = useState('');
  const [keywords, setKeywords] = useState<string[]>([]);
  const [draft, setDraft] = useState(false);
  const [inputError, setInputError] = useState('');
  const [operationError, setOperationError] = useState('');
  const [createdPath, setCreatedPath] = useState('');
  const { step, setStep, getStepStatus, goBack } = useStepFlow({
    initialStep: 'title' as Step,
    inputSteps: INPUT_STEPS,
    onComplete,
    showReturnHint,
  });

  useEffect(() => {
    if (step) setInputError((value) => (value ? '' : value));
  }, [step]);

  const displayValue = useCallback(
    (stepId: Step) => {
      if (stepId === 'title') return title;
      if (stepId === 'slug') return slug || '(none)';
      if (stepId === 'description') return description || '(none)';
      if (stepId === 'keywords') return keywords.join(', ') || '(none)';
      if (stepId === 'draft') return draft ? '是' : '否';
      return '';
    },
    [title, slug, description, keywords, draft],
  );

  const confirm = useCallback(async () => {
    if (await postExists(slug || undefined, title)) {
      setOperationError(`文章已存在: ${slug || generateSlug(title)}.md`);
      setStep('error');
      return;
    }
    setStep('creating');
    try {
      const data: PostData = {
        title,
        link: slug || undefined,
        description: description || undefined,
        keywords,
        draft,
      };
      setCreatedPath(await createPost(data));
      setStep('done');
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
      setStep('error');
    }
  }, [slug, title, description, keywords, draft, setStep]);

  const currentInput = () => {
    if (step === 'title') {
      return (
        <Box marginTop={1}>
          <Text dimColor>{'> '}</Text>
          <TextInput
            defaultValue={title}
            onSubmit={(value) => {
              if (!value.trim()) {
                setInputError('标题不能为空');
                return;
              }
              setTitle(value.trim());
              setAutoSlug(generateSlug(value.trim()));
              setStep('slug');
            }}
          />
        </Box>
      );
    }
    if (step === 'slug') {
      return (
        <Box flexDirection="column">
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput
              defaultValue={slug || autoSlug}
              onSubmit={(value) => {
                setSlug(value.trim());
                setStep('description');
              }}
            />
          </Box>
          <Text dimColor>文件会直接保存到扁平的文章目录</Text>
        </Box>
      );
    }
    if (step === 'description') {
      return (
        <Box marginTop={1}>
          <Text dimColor>{'> '}</Text>
          <TextInput
            defaultValue={description}
            onSubmit={(value) => {
              setDescription(value.trim());
              setStep('keywords');
            }}
          />
        </Box>
      );
    }
    if (step === 'keywords') {
      return (
        <Box flexDirection="column">
          <Box marginTop={1}>
            <Text dimColor>{'> '}</Text>
            <TextInput
              defaultValue={keywords.join(', ')}
              onSubmit={(value) => {
                setKeywords(
                  value
                    .split(/[,，]/)
                    .map((keyword) => keyword.trim())
                    .filter(Boolean),
                );
                setStep('draft');
              }}
            />
          </Box>
          <Text dimColor>用逗号分隔，仅用于 SEO</Text>
        </Box>
      );
    }
    if (step === 'draft') {
      return (
        <Select
          options={[
            { label: '否 - 立即发布', value: 'no' },
            { label: '是 - 保存为草稿', value: 'yes' },
          ]}
          onChange={(value) => {
            setDraft(value === 'yes');
            setStep('confirm');
          }}
        />
      );
    }
    return null;
  };

  if (step === 'confirm') {
    return (
      <ConfirmScreen
        title="新建文章"
        steps={STEP_CONFIGS.map(({ id, label }) => ({ label, value: displayValue(id) }))}
        confirmText="确认创建?"
        onConfirm={confirm}
        onCancel={() => goBack('confirm')}
      />
    );
  }
  if (step === 'creating') return <CreatingScreen title="新建文章" message="正在创建文章..." />;
  if (step === 'done') {
    return (
      <DoneScreen title="新建文章" message="文章创建成功!" detail={`路径: ${createdPath}`} showReturnHint={showReturnHint} />
    );
  }
  if (step === 'error') return <ErrorScreen title="新建文章" error={operationError} showReturnHint={showReturnHint} />;

  return (
    <Box flexDirection="column">
      <Box marginBottom={1}>
        <Text bold color="cyan">
          新建文章
        </Text>
      </Box>
      {STEP_CONFIGS.map(({ id, label }) => (
        <StepItem
          key={id}
          label={label}
          status={getStepStatus(id)}
          completedValue={displayValue(id)}
          error={getStepStatus(id) === 'active' ? inputError : undefined}
        >
          {getStepStatus(id) === 'active' && currentInput()}
        </StepItem>
      ))}
      {INPUT_STEPS.includes(step) && (
        <Box marginTop={1}>
          <Text dimColor>按 Esc 返回上一步，首步按 Esc 退出</Text>
        </Box>
      )}
    </Box>
  );
}
