import React from 'react'

const ProgressBar = (props) => {

  const { color, completed, label } = props;

  const containerStyles = {
    height: 20,
    width: '100%',
    backgroundColor: "#e0e0de",
    borderRadius: 50,
    marginTop: '1em',
    marginBottom: '1em'
  }

  const fillerStyles = {
    height: '100%',
    width: `${completed}%`,
    backgroundColor: color ? color : '#3273dc',
    borderRadius: 'inherit',
    transition: 'width 1s ease-in-out',
    textAlign: 'right' as 'right'
  }

  const labelStyles = {
    padding: 5,
    color: 'white',
    fontWeight: 'bold' as 'bold'
  }

  return (
    <div style={containerStyles}>
      <div style={fillerStyles}>
        <span style={labelStyles}>{`${label?label:''}`}</span>
      </div>
    </div>
  );
};

export default ProgressBar;
